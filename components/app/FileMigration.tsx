'use client';

import { useReducer, useEffect } from 'react';
import { MigrationService, MigrationFile, MigrationProgress } from '../../lib/migration-service';
import { SupabaseConfig, CloudflareConfig } from '../../lib/storage-utils';
import { migrateFileToR2 } from '@/actions/migrate';

interface FileMigrationProps {
    supabaseConfig: SupabaseConfig;
    cloudflareConfig: CloudflareConfig;
    isSupabaseConnected: boolean;
    isCloudflareConnected: boolean;
}

// State interface
interface FileMigrationState {
    files: MigrationFile[];
    loading: boolean;
    loadingError: string | null;
    migrationService: MigrationService | null;
    migrationProgress: MigrationProgress | null;
    prefix: string;
    migratedFiles: Set<string>; // Track which files have been migrated
    currentlyMigratingFile: string | null; // Track which file is currently being migrated
    totalMigratedCount: number; // Track total migrated files count across sessions
    totalFailedCount: number; // Track total failed migrations count
}

// Initial state
const initialState: FileMigrationState = {
    files: [],
    loading: false,
    loadingError: null,
    migrationService: null,
    migrationProgress: null,
    prefix: '',
    migratedFiles: new Set<string>(),
    currentlyMigratingFile: null,
    totalMigratedCount: 0,
    totalFailedCount: 0
};

// Action types
type Action = 
    | { type: 'SET_FILES', payload: MigrationFile[] }
    | { type: 'SET_LOADING', payload: boolean }
    | { type: 'SET_LOADING_ERROR', payload: string | null }
    | { type: 'SET_MIGRATION_SERVICE', payload: MigrationService | null }
    | { type: 'SET_MIGRATION_PROGRESS', payload: MigrationProgress | null }
    | { type: 'SET_PREFIX', payload: string }
    | { type: 'TOGGLE_FILE_SELECTION', payload: string }
    | { type: 'SELECT_ALL' }
    | { type: 'DESELECT_ALL' }
    | { type: 'SET_MIGRATED_FILES', payload: Set<string> }
    | { type: 'SET_CURRENTLY_MIGRATING', payload: string | null }
    | { type: 'INCREMENT_TOTAL_MIGRATED', payload: number }
    | { type: 'INCREMENT_TOTAL_FAILED', payload: number };

// Reducer function
function reducer(state: FileMigrationState, action: Action): FileMigrationState {
    switch (action.type) {
        case 'SET_FILES':
            return { ...state, files: action.payload };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_LOADING_ERROR':
            return { ...state, loadingError: action.payload };
        case 'SET_MIGRATION_SERVICE':
            return { ...state, migrationService: action.payload };
        case 'SET_MIGRATION_PROGRESS':
            return { ...state, migrationProgress: action.payload };
        case 'SET_PREFIX':
            return { ...state, prefix: action.payload };
        case 'TOGGLE_FILE_SELECTION':
            return {
                ...state,
                files: state.files.map(file => 
                    file.path === action.payload 
                        ? { ...file, selected: !file.selected } 
                        : file
                )
            };
        case 'SELECT_ALL':
            return {
                ...state,
                files: state.files.map(file => ({ ...file, selected: true }))
            };
        case 'DESELECT_ALL':
            return {
                ...state,
                files: state.files.map(file => ({ ...file, selected: false }))
            };
        case 'SET_MIGRATED_FILES':
            return { ...state, migratedFiles: action.payload || new Set<string>() };
        case 'SET_CURRENTLY_MIGRATING':
            return { ...state, currentlyMigratingFile: action.payload };
        case 'INCREMENT_TOTAL_MIGRATED':
            return { ...state, totalMigratedCount: state.totalMigratedCount + action.payload };
        case 'INCREMENT_TOTAL_FAILED':
            return { ...state, totalFailedCount: state.totalFailedCount + action.payload };
        default:
            return state;
    }
}

export default function FileMigration({
    supabaseConfig,
    cloudflareConfig,
    isSupabaseConnected,
    isCloudflareConnected
}: FileMigrationProps) {
    const [state, dispatch] = useReducer(reducer, {
        ...initialState,
        migratedFiles: new Set<string>() // Ensure migratedFiles is initialized
    });

    useEffect(() => {
        if (isSupabaseConnected) {
            try {
                // Create a migration service if both are connected, otherwise just Supabase
                const service = new MigrationService(
                    supabaseConfig, 
                    isCloudflareConnected ? cloudflareConfig : {}
                ); 
                
                dispatch({ type: 'SET_MIGRATION_SERVICE', payload: service });
            } catch (error) {
                console.error("Error initializing migration service:", error);
                dispatch({ 
                    type: 'SET_LOADING_ERROR', 
                    payload: error instanceof Error ? error.message : 'Failed to initialize migration service' 
                });
            }
        } else {
            dispatch({ type: 'SET_MIGRATION_SERVICE', payload: null });
        }
    }, [isSupabaseConnected, isCloudflareConnected, supabaseConfig, cloudflareConfig]);

    // Ensure migratedFiles is always initialized
    useEffect(() => {
        if (!state.migratedFiles) {
            dispatch({ type: 'SET_MIGRATED_FILES', payload: new Set<string>() });
        }
    }, [state.migratedFiles]);

    const loadFiles = async () => {
        if (!state.migrationService) return;
        
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_LOADING_ERROR', payload: null });
        
        try {
            const filesList = await state.migrationService.listFiles(state.prefix);
            
            // Mark files as not selected by default and maintain migration status
            const filesWithSelection = filesList.map(file => ({
                ...file,
                selected: false, // Default to not selected
            }));
            
            dispatch({ type: 'SET_FILES', payload: filesWithSelection });
        } catch (error) {
            console.error('Error loading files:', error);
            
            // Provide more user-friendly error messages
            let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            
            // Check for specific error types
            if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
                errorMessage = `Bucket "${supabaseConfig.bucketName}" not found or inaccessible. Please verify your bucket name and permissions.`;
            }
            
            dispatch({ type: 'SET_LOADING_ERROR', payload: errorMessage });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    const toggleFileSelection = (path: string) => {
        dispatch({ type: 'TOGGLE_FILE_SELECTION', payload: path });
    };

    const selectAll = () => {
        dispatch({ type: 'SELECT_ALL' });
    };

    const deselectAll = () => {
        dispatch({ type: 'DESELECT_ALL' });
    };

    const startMigration = async () => {
        try {
            const selectedFiles = state.files.filter(file => file.selected);
            if (selectedFiles.length === 0) {
                alert('Please select at least one file to migrate');
                return;
            }
            
            const totalFiles = selectedFiles.length;
            let completed = 0;
            let failed = 0;
            const errors: Record<string, string> = {};
            
            // This function will track migration progress
            const migrateFilesWithTracking = async (files: MigrationFile[]) => {
                
                for (const file of files) {
                    // Set currently migrating file
                    dispatch({ type: 'SET_CURRENTLY_MIGRATING', payload: file.path });
                    
                    try {
                        // Use the server action instead of the API
                        const result = await migrateFileToR2(
                            supabaseConfig,
                            cloudflareConfig,
                            file.path
                        );
                        
                        if (result.success) {
                            completed++;
                        } else {
                            failed++;
                            errors[file.path] = result.error || 'Unknown error';
                        }
                        
                        // Update progress
                        dispatch({ 
                            type: 'SET_MIGRATION_PROGRESS', 
                            payload: {
                                total: totalFiles,
                                completed,
                                failed,
                                errors,
                                inProgress: true
                            }
                        });
                    } catch (error) {
                        failed++;
                        errors[file.path] = error instanceof Error ? error.message : 'Network error';
                        
                        // Update progress
                        dispatch({ 
                            type: 'SET_MIGRATION_PROGRESS', 
                            payload: {
                                total: totalFiles,
                                completed,
                                failed,
                                errors,
                                inProgress: true
                            }
                        });
                    }
                }
                
                // Update progress with final state
                const finalProgress: MigrationProgress = {
                    total: totalFiles,
                    completed,
                    failed,
                    errors,
                    inProgress: false
                };
                
                // Clear currently migrating file
                dispatch({ type: 'SET_CURRENTLY_MIGRATING', payload: null });
                
                // Increment total counts
                dispatch({ type: 'INCREMENT_TOTAL_MIGRATED', payload: completed });
                dispatch({ type: 'INCREMENT_TOTAL_FAILED', payload: failed });
                
                return finalProgress;
            };
            
            const progress = await migrateFilesWithTracking(selectedFiles);
            dispatch({ type: 'SET_MIGRATION_PROGRESS', payload: progress });
            
            // Add successfully migrated files to the migratedFiles set
            const newMigratedFiles = new Set(state.migratedFiles || new Set<string>());
            
            // Files that completed successfully
            selectedFiles.forEach(file => {
                if (!progress.errors[file.path]) {
                    newMigratedFiles.add(file.path);
                }
            });
            
            dispatch({ type: 'SET_MIGRATED_FILES', payload: newMigratedFiles });
            
            // Update file selection after migration (deselect migrated files)
            const updatedFiles = state.files.map(file => ({
                ...file,
                selected: file.selected && !!progress.errors[file.path] // Only keep selected if there was an error
            }));
            
            dispatch({ type: 'SET_FILES', payload: updatedFiles });
        } catch (error) {
            console.error('Migration error:', error);
            alert(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            dispatch({ type: 'SET_CURRENTLY_MIGRATING', payload: null });
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // Helper function to safely check if a file is migrated
    const isFileMigrated = (filePath: string): boolean => {
        return Boolean(state.migratedFiles?.has(filePath));
    };
    
    // Helper function to check if a file is currently being migrated
    const isCurrentlyMigrating = (filePath: string): boolean => {
        return state.currentlyMigratingFile === filePath;
    };

    return (
        <div className="mt-4 bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900">
                            File Migration
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Transfer files from Supabase Storage to Cloudflare R2
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadFiles}
                        disabled={state.loading || !state.migrationService}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {state.files.length > 0 ? 'Refresh Files' : 'Load Files'}
                    </button>
                </div>
            </div>

            <div className="px-4 py-5 sm:p-6">
                {!isSupabaseConnected ? (
                    <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-md">
                        <p className="text-sm text-yellow-700 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Please connect to Supabase to view and migrate files
                        </p>
                    </div>
                ) : (
                    <>
                        {!isCloudflareConnected && (
                            <div className="mb-4 p-3 border border-amber-200 bg-amber-50 rounded-md">
                                <p className="text-sm text-amber-700 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium">Note:</span> File browsing is available, but migration requires Cloudflare R2 connection
                                </p>
                            </div>
                        )}
                        
                        
                        {/* File Table and Migration Controls - Bottom Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* File Browser Table - Left Side (takes 8/12 of the width) */}
                            <div className="lg:col-span-8">
                                {state.loadingError && (
                                    <div className="p-4 mb-4 text-sm text-red-700 bg-red-50 rounded-md border border-red-200" role="alert">
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                            </svg>
                                            <span className="font-medium">Error:</span> {state.loadingError}
                                        </div>
                                    </div>
                                )}
                                
                                {state.loading ? (
                                    <div className="flex justify-center items-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                                        <div className="flex flex-col items-center">
                                            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 border-t-indigo-500 animate-spin"></div>
                                            <p className="text-sm text-gray-500">Loading files from Supabase...</p>
                                        </div>
                                    </div>
                                ) : state.files.length > 0 ? (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="flex justify-between p-2 bg-gray-50 border-b border-gray-200">
                                            <div className="flex items-center">
                                                <span className="text-sm font-medium text-gray-700">
                                                    {state.files.filter(f => f.selected).length} of {state.files.length} files selected
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={startMigration}
                                                disabled={state.migrationProgress?.inProgress || state.files.filter(f => f.selected).length === 0}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                            >
                                                {state.migrationProgress?.inProgress ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Migrating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                        </svg>
                                                        Start Migration
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <div className="max-h-96 overflow-y-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50 sticky top-0 z-10">
                                                    <tr>
                                                        {isCloudflareConnected && (
                                                            <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                                                                    checked={state.files.length > 0 && state.files.every(f => f.selected)}
                                                                />
                                                            </th>
                                                        )}
                                                        <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            File Path
                                                        </th>
                                                        <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Size
                                                        </th>
                                                        <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Last Modified
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {state.files.map((file) => (
                                                        <tr key={file.path} className="hover:bg-gray-50">
                                                            {isCloudflareConnected && (
                                                                <td className="px-6 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={file.selected}
                                                                        onChange={() => toggleFileSelection(file.path)}
                                                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                <div className="flex items-center">
                                                                    <span className={isFileMigrated(file.path) ? "text-green-600" : ""}>
                                                                        {file.path}
                                                                    </span>
                                                                    {isFileMigrated(file.path) && (
                                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                            Migrated
                                                                        </span>
                                                                    )}
                                                                    {isCurrentlyMigrating(file.path) && (
                                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                                                                            Migrating...
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                {formatBytes(file.size)}
                                                            </td>
                                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                {file.lastModified ? new Date(file.lastModified).toLocaleString() : 'N/A'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-center items-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
                                        <div className="text-center max-w-sm px-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                            <h3 className="mt-2 text-sm font-medium text-gray-900">No files loaded</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Use the file path input above to browse your Supabase bucket
                                            </p>
                                            <div className="mt-6">
                                                <button
                                                    type="button"
                                                    onClick={loadFiles}
                                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    Load Files
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Migration Overview - Right Side (takes 4/12 of the width) */}
                            <div className="lg:col-span-4">
                                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 overflow-y-auto h-full">
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">Migration Overview</h3>
                                    
                                    {/* File Path Input */}
                                    <div className="border border-gray-200 rounded-md bg-white p-3 mb-3">
                                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">File Path</h4>
                                        <div className="mt-1 flex rounded-md shadow-sm">
                                            <div className="relative flex items-stretch flex-grow focus-within:z-10">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                                                        <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
                                                    </svg>
                                                </div>
                                                <input
                                                    type="text"
                                                    id="prefix"
                                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md pl-8 py-1.5 text-xs border-gray-300"
                                                    value={state.prefix}
                                                    onChange={(e) => dispatch({ type: 'SET_PREFIX', payload: e.target.value })}
                                                    placeholder="Enter folder path (e.g. images/)"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            loadFiles();
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={loadFiles}
                                                disabled={state.loading}
                                                className="-ml-px relative inline-flex items-center px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                            >
                                                {state.loading ? (
                                                    <>
                                                        <svg className="animate-spin h-3 w-3 mr-1 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Loading
                                                    </>
                                                ) : (
                                                    <span className="flex items-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                        </svg>
                                                        Browse
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {!isCloudflareConnected ? (
                                        <div className="text-center py-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                            <h3 className="mt-2 text-sm font-medium text-gray-900">Connect to Cloudflare R2</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Connection to Cloudflare R2 is required for migration
                                            </p>
                                        </div>
                                    ) : state.files.length === 0 ? (
                                        <div className="text-center py-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <h3 className="mt-2 text-sm font-medium text-gray-900">No files to migrate</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Load files first to start a migration
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="border border-gray-200 rounded-md bg-white p-4 mb-2">
                                            <h4 className="text-sm font-medium text-gray-900 mb-2">Migration Status</h4>
                                            
                                            {state.currentlyMigratingFile && (
                                                <div className="mb-2 p-2 bg-amber-50 border border-amber-100 rounded text-sm">
                                                    <div className="flex items-center">
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        <span>Currently migrating: <span className="font-medium">{state.currentlyMigratingFile}</span></span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="mb-4">
                                                <div className="flex mb-1 items-center justify-between">
                                                    <div>
                                                        <span className="text-xs font-semibold inline-block text-indigo-600">
                                                            {state.migrationProgress ? 
                                                                Math.round((state.migrationProgress.completed + state.migrationProgress.failed) / state.migrationProgress.total * 100) : 0}%
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-semibold inline-block text-indigo-600">
                                                            {state.migrationProgress ? 
                                                                `${state.migrationProgress.completed + state.migrationProgress.failed} / ${state.migrationProgress.total}` : '0 / 0'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                                    <div className="flex h-full rounded-full overflow-hidden">
                                                        <div
                                                            style={{ width: `${state.migrationProgress ? 
                                                                Math.round(state.migrationProgress.completed / state.migrationProgress.total * 100) : 0}%` }}
                                                            className="bg-green-500 h-2.5"
                                                        ></div>
                                                        <div
                                                            style={{ width: `${state.migrationProgress ? 
                                                                Math.round(state.migrationProgress.failed / state.migrationProgress.total * 100) : 0}%` }}
                                                            className="bg-red-500 h-2.5"
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 text-center mb-2">
                                                <div className="bg-gray-50 rounded p-2">
                                                    <p className="text-sm font-medium text-gray-900">{state.migrationProgress?.total || 0}</p>
                                                    <p className="text-xs text-gray-500">Current Batch</p>
                                                </div>
                                                <div className="bg-green-50 rounded p-2">
                                                    <p className="text-sm font-medium text-green-600">{state.migrationProgress?.completed || 0}</p>
                                                    <p className="text-xs text-gray-500">Completed</p>
                                                </div>
                                                <div className="bg-red-50 rounded p-2">
                                                    <p className="text-sm font-medium text-red-600">{state.migrationProgress?.failed || 0}</p>
                                                    <p className="text-xs text-gray-500">Failed</p>
                                                </div>
                                            </div>

                                            <div className="border-t border-gray-200 pt-2 mt-2">
                                                <div className="grid grid-cols-2 gap-2 text-center">
                                                    <div className="bg-green-50 rounded p-2">
                                                        <p className="text-sm font-medium text-green-600">{state.totalMigratedCount}</p>
                                                        <p className="text-xs text-gray-500">Total Migrated</p>
                                                    </div>
                                                    <div className="bg-red-50 rounded p-2">
                                                        <p className="text-sm font-medium text-red-600">{state.totalFailedCount}</p>
                                                        <p className="text-xs text-gray-500">Total Failed</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {state.migrationProgress && Object.keys(state.migrationProgress.errors).length > 0 && (
                                                <div className="mt-3">
                                                    <h5 className="text-sm font-medium text-gray-900 mb-1">Error Details</h5>
                                                    <div className="bg-red-50 p-2 rounded border border-red-100 max-h-40 overflow-y-auto">
                                                        <ul className="text-xs text-red-600">
                                                            {Object.entries(state.migrationProgress.errors).map(([path, error]) => (
                                                                <li key={path} className="py-1 border-b border-red-100 last:border-0">
                                                                    <div className="font-medium">{path}</div>
                                                                    <div>{error}</div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}