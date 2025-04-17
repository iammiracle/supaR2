import { useReducer, useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, CloudflareConfig, initSupabaseClient } from '../../lib/storage-utils';

interface TableMigrationProps {
    supabaseConfig: SupabaseConfig;
    cloudflareConfig: CloudflareConfig;
    isSupabaseConnected: boolean;
    isCloudflareConnected: boolean;
}

// Table Row with image URL
interface TableRow {
    id: string;
    [key: string]: unknown; // Other fields in the row, change any to unknown
    selected?: boolean;
}

interface TableInfo {
    name: string;
    columns: string[];
    imageColumns: string[]; // Columns that contain image URLs
}

// State interface
interface TableMigrationState {
    migratedRows: Set<string>;
    tables: TableInfo[];
    selectedTable: string | null;
    rows: TableRow[];
    loading: boolean;
    loadingError: string | null;
    supabaseClient: SupabaseClient | null;
    migrationProgress: MigrationProgress | null;
    currentlyMigratingRow: string | null;
    totalMigratedCount: number;
    totalFailedCount: number;
    supabaseConfig: SupabaseConfig | null;
}

// Define migration progress interface
interface MigrationProgress {
    total: number;
    completed: number;
    failed: number;
    inProgress: boolean;
    errors: Record<string, string>;
}

// Initial state
const initialState: TableMigrationState = {
    tables: [],
    selectedTable: null,
    rows: [],
    loading: false,
    loadingError: null,
    supabaseClient: null,
    migrationProgress: null,
    migratedRows: new Set<string>(),
    currentlyMigratingRow: null,
    totalMigratedCount: 0,
    totalFailedCount: 0,
    supabaseConfig: null
};

// Action types
type Action = 
    | { type: 'SET_TABLES', payload: TableInfo[] }
    | { type: 'SET_SELECTED_TABLE', payload: string | null }
    | { type: 'SET_ROWS', payload: TableRow[] }
    | { type: 'SET_LOADING', payload: boolean }
    | { type: 'SET_LOADING_ERROR', payload: string | null }
    | { type: 'SET_SUPABASE_CLIENT', payload: SupabaseClient | null }
    | { type: 'SET_MIGRATION_PROGRESS', payload: MigrationProgress | null }
    | { type: 'TOGGLE_ROW_SELECTION', payload: string }
    | { type: 'SELECT_ALL' }
    | { type: 'DESELECT_ALL' }
    | { type: 'SET_MIGRATED_ROWS', payload: Set<string> }
    | { type: 'SET_CURRENTLY_MIGRATING_ROW', payload: string | null }
    | { type: 'INCREMENT_TOTAL_MIGRATED', payload: number }
    | { type: 'INCREMENT_TOTAL_FAILED', payload: number };

// Reducer function
function reducer(state: TableMigrationState, action: Action): TableMigrationState {
    switch (action.type) {
        case 'SET_TABLES':
            return { ...state, tables: action.payload };
        case 'SET_SELECTED_TABLE':
            return { ...state, selectedTable: action.payload };
        case 'SET_ROWS':
            return { ...state, rows: action.payload };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_LOADING_ERROR':
            return { ...state, loadingError: action.payload };
        case 'SET_SUPABASE_CLIENT':
            return { ...state, supabaseClient: action.payload };
        case 'SET_MIGRATION_PROGRESS':
            return { ...state, migrationProgress: action.payload };
        case 'TOGGLE_ROW_SELECTION':
            return {
                ...state,
                rows: state.rows.map(row => 
                    row.id === action.payload 
                        ? { ...row, selected: !row.selected } 
                        : row
                )
            };
        case 'SELECT_ALL':
            return {
                ...state,
                rows: state.rows.map(row => ({ ...row, selected: true }))
            };
        case 'DESELECT_ALL':
            return {
                ...state,
                rows: state.rows.map(row => ({ ...row, selected: false }))
            };
        case 'SET_MIGRATED_ROWS':
            return { ...state, migratedRows: action.payload || new Set<string>() };
        case 'SET_CURRENTLY_MIGRATING_ROW':
            return { ...state, currentlyMigratingRow: action.payload };
        case 'INCREMENT_TOTAL_MIGRATED':
            return { ...state, totalMigratedCount: state.totalMigratedCount + action.payload };
        case 'INCREMENT_TOTAL_FAILED':
            return { ...state, totalFailedCount: state.totalFailedCount + action.payload };
        default:
            return state;
    }
}

export default function TableMigration({
    supabaseConfig,
    cloudflareConfig,
    isSupabaseConnected,
    isCloudflareConnected
}: TableMigrationProps) {
    const [state, dispatch] = useReducer(reducer, {
        ...initialState,
        migratedRows: new Set<string>() // Ensure migratedRows is initialized
    });
    
    // State for image column selection
    const [selectedImageColumn, setSelectedImageColumn] = useState<string | null>(null);

    // Initialize Supabase client
    useEffect(() => {
        if (isSupabaseConnected) {
            try {
                const client = initSupabaseClient(supabaseConfig);
                dispatch({ type: 'SET_SUPABASE_CLIENT', payload: client });
            } catch (error) {
                console.error("Error initializing Supabase client:", error);
                dispatch({ 
                    type: 'SET_LOADING_ERROR', 
                    payload: error instanceof Error ? error.message : 'Failed to initialize Supabase client' 
                });
            }
        } else {
            dispatch({ type: 'SET_SUPABASE_CLIENT', payload: null });
        }
    }, [isSupabaseConnected, supabaseConfig]);

    // Ensure migratedRows is always initialized
    useEffect(() => {
        if (!state.migratedRows) {
            dispatch({ type: 'SET_MIGRATED_ROWS', payload: new Set<string>() });
        }
    }, [state.migratedRows]);

    // Fetch tables when the client is initialized
    useEffect(() => {
        if (state.supabaseClient && supabaseConfig.bucketName) {
            // Set the table name directly from props
            dispatch({ type: 'SET_SELECTED_TABLE', payload: supabaseConfig.bucketName });
            
            // Load the columns for this table
            loadColumns(supabaseConfig.bucketName);
        }
    }, [state.supabaseClient, supabaseConfig.bucketName]);

    // Load columns for a specific table
    const loadColumns = async (tableName: string) => {
        if (!state.supabaseClient) return;
        
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_LOADING_ERROR', payload: null });
        
        try {
            // Instead of querying information_schema.columns which is failing,
            // let's just get the rows and infer the columns from the data
            const { data, error } = await state.supabaseClient
                .from(tableName)
                .select('*')
                .limit(5); // Just get a few rows to determine structure
            
            if (error) {
                console.error(`Error fetching data from table ${tableName}:`, error);
                dispatch({ 
                    type: 'SET_LOADING_ERROR', 
                    payload: error.message || 'Error fetching data from the table'
                });
                return;
            }
            
            if (!data || data.length === 0) {
                dispatch({ 
                    type: 'SET_LOADING_ERROR', 
                    payload: 'No data found in this table'
                });
                return;
            }
            
            // Get column names from the first row
            const firstRow = data[0];
            const columns = Object.keys(firstRow);
            
            // Determine potential image URL columns by checking the values
            const imageColumns = columns.filter(colName => {
                // Check if any row has a value that looks like a URL
                return data.some(row => {
                    const value = row[colName];
                    return typeof value === 'string' && 
                           (value.startsWith('http') || 
                            value.includes('/') || 
                            value.match(/\.(jpg|jpeg|png|gif|webp|svg)/i));
                });
            });
            
            // Create a table info object
            const tableInfo: TableInfo = {
                name: tableName,
                columns,
                imageColumns
            };
            
            // Update the state with the table info
            dispatch({ type: 'SET_TABLES', payload: [tableInfo] });
            
            // Set first image column as default selected
            if (imageColumns.length > 0) {
                setSelectedImageColumn(imageColumns[0]);
                // Load the rows from the table
                await loadRows(tableName);
            } else {
                dispatch({ 
                    type: 'SET_LOADING_ERROR', 
                    payload: 'This table has no columns that could contain image URLs'
                });
            }
        } catch (error) {
            console.error(`Error processing columns for table ${tableName}:`, error);
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message || 'Error loading columns';
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            dispatch({ 
                type: 'SET_LOADING_ERROR', 
                payload: errorMessage
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    // Load rows from the selected table
    const loadRows = async (tableName: string) => {
        if (!state.supabaseClient) return;
        
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_LOADING_ERROR', payload: null });
        
        try {
            // Get all rows from the table
            const { data, error } = await state.supabaseClient
                .from(tableName)
                .select('*')
                .limit(100); // Limit to 100 rows for performance
                
            if (error) throw error;
            
            if (!data) {
                dispatch({ type: 'SET_ROWS', payload: [] });
                return;
            }
            
            // Add selected property to each row
            const rowsWithSelection = data.map(row => ({
                ...row,
                selected: false // Default to not selected
            }));
            
            dispatch({ type: 'SET_ROWS', payload: rowsWithSelection });
        } catch (error) {
            console.error(`Error loading rows from ${tableName}:`, error);
            dispatch({ 
                type: 'SET_LOADING_ERROR', 
                payload: error instanceof Error ? error.message : 'An unknown error occurred' 
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    // Toggle a row's selection
    const toggleRowSelection = (id: string) => {
        dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: id });
    };

    // Select all rows
    const selectAll = () => {
        dispatch({ type: 'SELECT_ALL' });
    };

    // Deselect all rows
    const deselectAll = () => {
        dispatch({ type: 'DESELECT_ALL' });
    };

    // Start the migration process
    const startMigration = async () => {
        if (!state.supabaseClient || !state.selectedTable || !selectedImageColumn) {
            alert('Please select a table and image column first');
            return;
        }
        
        if (!isCloudflareConnected) {
            alert('Please connect to Cloudflare R2 first');
            return;
        }
        
        const selectedRows = state.rows.filter(row => row.selected);
        if (selectedRows.length === 0) {
            alert('Please select at least one row to migrate');
            return;
        }
        
        try {
            // Set migration as in progress
            const progress: MigrationProgress = {
                total: selectedRows.length,
                completed: 0,
                failed: 0,
                errors: {},
                inProgress: true
            };
            
            dispatch({ type: 'SET_MIGRATION_PROGRESS', payload: progress });
            
            // Process each selected row
            for (const row of selectedRows) {
                // Skip if there's no image URL in this row
                const imageUrl = row[selectedImageColumn];
                if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
                    // Count as failed
                    progress.failed++;
                    progress.errors[row.id] = `No valid image URL found in the "${selectedImageColumn}" column`;
                    dispatch({ type: 'SET_MIGRATION_PROGRESS', payload: {...progress} });
                    continue;
                }
                
                // Set currently migrating row
                dispatch({ type: 'SET_CURRENTLY_MIGRATING_ROW', payload: row.id });
                
                try {
                    // Extract the file path from the URL
                    // This assumes the URL is in a format like 'https://.../storage/v1/object/public/bucket/path/to/file.jpg'
                    let filePath = '';
                    
                    try {
                        const url = new URL(imageUrl);
                        const pathParts = url.pathname.split('/');
                        
                        // Find the bucket name in the path
                        const bucketIndex = pathParts.findIndex(part => part === supabaseConfig.bucketName);
                        
                        if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                            // Extract the file path after the bucket name
                            filePath = pathParts.slice(bucketIndex + 1).join('/');
                        } else {
                            // If we can't find the bucket in the path, try to extract filename from the end of the path
                            filePath = pathParts[pathParts.length - 1];
                        }
                    } catch {
                        // If URL parsing fails, just use the original URL
                        filePath = imageUrl;
                    }
                    
                    if (!filePath) {
                        throw new Error('Could not extract file path from URL');
                    }
                    
                    // Call the API to migrate the file
                    const response = await fetch('/api/migrate-to-r2', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            supabaseConfig: supabaseConfig,
                            cloudflareConfig: cloudflareConfig,
                            filePath: filePath
                        }),
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Get the new URL from R2
                        // Check if we have a custom domain in cloudflare config and use it if available
                        const newUrl = result.url || 
                            (cloudflareConfig.customDomain 
                                ? `https://${cloudflareConfig.customDomain}/${filePath}`
                                : `https://${cloudflareConfig.bucketName}.${cloudflareConfig.accountId}.r2.cloudflarestorage.com/${filePath}`);
                        
                        console.log(`Migrating file: ${filePath} to ${newUrl}`);
                        // Update the table with the new URL
                        const { error: updateError } = await state.supabaseClient
                            .from(state.selectedTable)
                            .update({ [selectedImageColumn]: newUrl })
                            .eq('id', row.id);
                            
                        if (updateError) {
                            throw updateError;
                        }
                        
                        progress.completed++;
                        
                        // Add to migrated rows
                        const newMigratedRows = new Set(state.migratedRows);
                        newMigratedRows.add(row.id);
                        dispatch({ type: 'SET_MIGRATED_ROWS', payload: newMigratedRows });
                    } else {
                        progress.failed++;
                        progress.errors[row.id] = result.error || 'Unknown error during migration';
                    }
                } catch (error) {
                    progress.failed++;
                    progress.errors[row.id] = error instanceof Error ? error.message : 'Network error';
                }
                
                // Update progress
                dispatch({ 
                    type: 'SET_MIGRATION_PROGRESS', 
                    payload: {...progress}
                });
            }
            
            // Complete the migration
            dispatch({ 
                type: 'SET_MIGRATION_PROGRESS', 
                payload: {...progress, inProgress: false}
            });
            
            // Clear currently migrating row
            dispatch({ type: 'SET_CURRENTLY_MIGRATING_ROW', payload: null });
            
            // Increment total counts
            dispatch({ type: 'INCREMENT_TOTAL_MIGRATED', payload: progress.completed });
            dispatch({ type: 'INCREMENT_TOTAL_FAILED', payload: progress.failed });
            
            // Reload rows to show updated URLs
            if (progress.completed > 0) {
                await loadRows(state.selectedTable);
            }
        } catch (error) {
            console.error('Migration error:', error);
            alert(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            dispatch({ type: 'SET_CURRENTLY_MIGRATING_ROW', payload: null });
            
            // Set migration as not in progress
            if (state.migrationProgress) {
                dispatch({ 
                    type: 'SET_MIGRATION_PROGRESS', 
                    payload: {...state.migrationProgress, inProgress: false}
                });
            }
        }
    };

    // Helper function to safely check if a row is migrated
    const isRowMigrated = (rowId: string): boolean => {
        return Boolean(state.migratedRows?.has(rowId));
    };
    
    // Helper function to check if a row is currently being migrated
    const isCurrentlyMigrating = (rowId: string): boolean => {
        return state.currentlyMigratingRow === rowId;
    };

    // Load tables from the database
    const loadTables = async () => {
        if (!state.supabaseClient) return;
        
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_LOADING_ERROR', payload: null });
        
        try {
            // Skip problematic queries that we know often fail and cause 404 errors
            // Instead, directly use the API endpoint approach which works reliably
            try {
                const response = await fetch('/api/tables', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        supabaseUrl: supabaseConfig.supabaseUrl,
                        supabaseKey: supabaseConfig.supabaseKey,
                        bucketName: supabaseConfig.bucketName
                    }),
                });
                
                const responseData = await response.json();
                
                if (responseData.tables && responseData.tables.length > 0) {
                    // Convert raw table names to TableInfo objects
                    const tableInfos = responseData.tables.map((name: string) => ({ 
                        name, 
                        columns: [], 
                        imageColumns: [] 
                    }));
                    
                    dispatch({ type: 'SET_TABLES', payload: tableInfos });
                    
                    // If we received a bucketName from the config, use it as the selected table
                    if (supabaseConfig.bucketName) {
                        const matchingTable = tableInfos.find(
                            (t: TableInfo) => t.name === supabaseConfig.bucketName
                        );
                        
                        if (matchingTable) {
                            dispatch({ type: 'SET_SELECTED_TABLE', payload: supabaseConfig.bucketName });
                            loadColumns(supabaseConfig.bucketName);
                        } else if (tableInfos.length > 0) {
                            // Or select the first table
                            dispatch({ type: 'SET_SELECTED_TABLE', payload: tableInfos[0].name });
                            loadColumns(tableInfos[0].name);
                        }
                    } else if (tableInfos.length > 0) {
                        // If no bucketName, select the first table
                        dispatch({ type: 'SET_SELECTED_TABLE', payload: tableInfos[0].name });
                        loadColumns(tableInfos[0].name);
                    }
                } else {
                    dispatch({
                        type: 'SET_LOADING_ERROR',
                        payload: 'No tables found in the database. Create a table first.'
                    });
                }
            } catch (apiError) {
                console.error('API error:', apiError);
                dispatch({
                    type: 'SET_LOADING_ERROR',
                    payload: 'Error fetching tables: ' + (apiError instanceof Error ? apiError.message : String(apiError))
                });
            }
        } catch (error) {
            console.error('Error loading tables:', error);
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            dispatch({ 
                type: 'SET_LOADING_ERROR', 
                payload: errorMessage
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    // Add useEffect to call loadTables when supabaseClient changes
    useEffect(() => {
        if (state.supabaseClient) {
            loadTables();
        }
    }, [state.supabaseClient]);

    // This function is currently unused but kept for future implementation of direct Supabase upload functionality
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const uploadToSupabase = async () => {
        if (state.selectedTable && selectedImageColumn && state.tables) {
            // Not using these variables, so commenting them out to avoid linter errors
            // const imageURLs: { [key: string]: string } = {};
            
            // Create a new Supabase client for the upload
            // const supabaseClient = initSupabaseClient({
            //     supabaseUrl: state.supabaseConfig?.supabaseUrl || '',
            //     supabaseKey: state.supabaseConfig?.supabaseKey || '',
            //     bucketName: state.supabaseConfig?.bucketName || ''
            // });
            
            // ... existing code ...
        }
    };

    return (
        <div className="mt-4 bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900">
                            Image Migration
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Migrate images from Supabase Storage to Cloudflare R2
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => supabaseConfig.bucketName && loadColumns(supabaseConfig.bucketName)}
                        disabled={state.loading || !state.supabaseClient}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh Columns
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
                            Please connect to Supabase to view and migrate table data
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
                                    <span className="font-medium">Note:</span> Table browsing is available, but migration requires Cloudflare R2 connection
                                </p>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Top Row: Selection Panel and Migration Controls */}
                            <div className="lg:col-span-8">
                                {/* Selection Panel */}
                                <div className="h-full p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-900 mb-4">Image Column Selection</h4>
                                    
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
                                    
                                    {/* Table info display */}
                                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-md">
                                        <div className="text-sm text-indigo-700">
                                            <span className="font-semibold">Selected Table:</span> {state.selectedTable || supabaseConfig.bucketName}
                                        </div>
                                    </div>
                                    
                                    {/* Table and Column Selection in a grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                                        {/* Image Column Selection */}
                                        <div>
                                            <label htmlFor="column-select" className="block text-sm font-medium text-gray-700 mb-1">
                                                Select Image URL Column
                                            </label>
                                            <select
                                                id="column-select"
                                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                                value={selectedImageColumn || ''}
                                                onChange={(e) => setSelectedImageColumn(e.target.value)}
                                                disabled={state.loading || !state.tables.length || !state.tables[0]?.imageColumns.length}
                                            >
                                                <option value="">-- Select a column --</option>
                                                {state.tables.length > 0 && state.tables[0]?.imageColumns.map((column) => (
                                                    <option key={column} value={column}>
                                                        {column}
                                                    </option>
                                                ))}
                                            </select>
                                            {state.tables.length > 0 && state.tables[0]?.imageColumns.length === 0 && !state.loading && (
                                                <p className="mt-1 text-xs text-gray-500">
                                                    No image columns found in this table. A table must have text or varchar columns to store image URLs. This error can also occur if your database credentials don&apos;t have permission to query table structure or if there&apos;s no data in the table yet.
                                                </p>
                                            )}
                                            <p className="mt-1 text-xs text-gray-500">
                                                Select the column containing image URLs to migrate
                                            </p>
                                        </div>
                                        
                                        {/* File Path Pattern (Optional) */}
                                        <div>
                                            <label htmlFor="file-pattern" className="block text-sm font-medium text-gray-700 mb-1">
                                                File Path Pattern (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                id="file-pattern"
                                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                                placeholder="e.g., images/*.jpg"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                Specify a pattern to filter files (leave empty for all files)
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Selected Information Display */}
                                    {selectedImageColumn && (
                                        <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-md">
                                            <div className="flex items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <div className="text-sm text-green-700">
                                                    <span className="font-medium">Ready to migrate:</span> Images from column <span className="font-semibold">{selectedImageColumn}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Migration Panel - Right Side */}
                            <div className="lg:col-span-4">
                                <div className="h-full bg-gray-50 rounded-lg border border-gray-200 p-4">
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">Migration Controls</h3>
                                    
                                    {!isCloudflareConnected ? (
                                        <div className="text-center py-5">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                            <h3 className="mt-2 text-sm font-medium text-gray-900">Connect to Cloudflare R2</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Connection to Cloudflare R2 is required for migration
                                            </p>
                                        </div>
                                    ) : !state.selectedTable ? (
                                        <div className="flex justify-center items-center h-full">
                                            <div className="text-center px-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                                </svg>
                                                <h3 className="mt-2 text-sm font-medium text-gray-900">Select a Table</h3>
                                                <p className="mt-1 text-sm text-gray-500">
                                                    Choose a table with image URLs to migrate
                                                </p>
                                            </div>
                                        </div>
                                    ) : state.selectedTable && state.rows.length > 0 ? (
                                        <div className="border border-gray-200 rounded-md bg-white p-4">
                                            <h4 className="text-sm font-medium text-gray-900 mb-2">Migration Progress</h4>
                                            
                                            {state.currentlyMigratingRow && (
                                                <div className="mb-2 p-2 bg-amber-50 border border-amber-100 rounded text-sm">
                                                    <div className="flex items-center">
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        <span>Currently migrating row: <span className="font-medium">{state.currentlyMigratingRow}</span></span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="mb-4">
                                                <div className="flex mb-1 items-center justify-between">
                                                    <div>
                                                        <span className="text-xs font-semibold inline-block text-indigo-600">
                                                            {state.migrationProgress ? Math.round((state.migrationProgress.completed + state.migrationProgress.failed) / state.migrationProgress.total * 100) : 0}%
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-semibold inline-block text-indigo-600">
                                                            {state.migrationProgress ? (state.migrationProgress.completed + state.migrationProgress.failed) : 0} / {state.migrationProgress ? state.migrationProgress.total : state.rows.filter(r => r.selected).length || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                                    <div className="flex h-full rounded-full overflow-hidden">
                                                        <div
                                                            style={{ width: `${state.migrationProgress ? Math.round(state.migrationProgress.completed / state.migrationProgress.total * 100) : 0}%` }}
                                                            className="bg-green-500 h-2.5"
                                                        ></div>
                                                        <div
                                                            style={{ width: `${state.migrationProgress ? Math.round(state.migrationProgress.failed / state.migrationProgress.total * 100) : 0}%` }}
                                                            className="bg-red-500 h-2.5"
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 text-center mb-2">
                                                <div className="bg-gray-50 rounded p-2">
                                                    <p className="text-sm font-medium text-gray-900">{state.migrationProgress ? state.migrationProgress.total : state.rows.filter(r => r.selected).length || 0}</p>
                                                    <p className="text-xs text-gray-500">Selected Rows</p>
                                                </div>
                                                <div className="bg-green-50 rounded p-2">
                                                    <p className="text-sm font-medium text-green-600">{state.migrationProgress ? state.migrationProgress.completed : 0}</p>
                                                    <p className="text-xs text-gray-500">Completed</p>
                                                </div>
                                                <div className="bg-red-50 rounded p-2">
                                                    <p className="text-sm font-medium text-red-600">{state.migrationProgress ? state.migrationProgress.failed : 0}</p>
                                                    <p className="text-xs text-gray-500">Failed</p>
                                                </div>
                                            </div>

                                            <div className="border-t border-gray-200 pt-2 mt-2">
                                                <div className="grid grid-cols-2 gap-2 text-center">
                                                    <div className="bg-green-50 rounded p-2">
                                                        <p className="text-sm font-medium text-green-600">{state.totalMigratedCount || 0}</p>
                                                        <p className="text-xs text-gray-500">Total Migrated</p>
                                                    </div>
                                                    <div className="bg-red-50 rounded p-2">
                                                        <p className="text-sm font-medium text-red-600">{state.totalFailedCount || 0}</p>
                                                        <p className="text-xs text-gray-500">Total Failed</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {state.migrationProgress && Object.keys(state.migrationProgress.errors).length > 0 && (
                                                <div className="mt-3">
                                                    <h5 className="text-sm font-medium text-gray-900 mb-1">Error Details</h5>
                                                    <div className="bg-red-50 p-2 rounded border border-red-100 max-h-40 overflow-y-auto">
                                                        <ul className="text-xs text-red-600">
                                                            {Object.entries(state.migrationProgress.errors).map(([rowId, error]) => (
                                                                <li key={rowId} className="py-1 border-b border-red-100 last:border-0">
                                                                    <div className="font-medium">Row ID: {rowId}</div>
                                                                    <div>{error}</div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-5">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                            <h3 className="mt-2 text-sm font-medium text-gray-900">Ready to Migrate</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Select rows and click Migrate to transfer image files
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Full Width Data Table */}
                        <div className="mt-6">
                            {/* Row Table Display */}
                            {state.selectedTable && selectedImageColumn && state.rows.length > 0 && (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="flex justify-between p-2 bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center">
                                            
                                            <span className="text-sm font-medium text-gray-700">
                                                {state.rows.filter(r => r.selected).length} of {state.rows.length} rows selected
                                            </span>
                                        </div>
                                        
                                        {isCloudflareConnected && (
                                            <button
                                                type="button"
                                                onClick={startMigration}
                                                disabled={state.rows.filter(r => r.selected).length === 0 || state.migrationProgress?.inProgress}
                                                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                            >
                                                {state.migrationProgress?.inProgress ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Migrating...
                                                    </>
                                                ) : (
                                                    <>Migrate Selected Rows</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="max-h-96 overflow-y-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                                        {isCloudflareConnected && (
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-2"
                                                                onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                                                                checked={state.rows.length > 0 && state.rows.every(r => r.selected)}
                                                            />
                                                        )}
                                                        <span className="sr-only">Select</span>
                                                    </th>
                                                    <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        ID
                                                    </th>
                                                    <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        {selectedImageColumn}
                                                    </th>
                                                    <th scope="col" className="sticky top-0 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Status
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {state.rows.map((row) => (
                                                    <tr key={row.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <input
                                                                type="checkbox"
                                                                checked={row.selected}
                                                                onChange={() => toggleRowSelection(row.id)}
                                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                disabled={state.migrationProgress?.inProgress}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {row.id}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                                                            {typeof row[selectedImageColumn] === 'string' ? (
                                                                <a 
                                                                    href={row[selectedImageColumn]} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                                                >
                                                                    {row[selectedImageColumn]}
                                                                </a>
                                                            ) : (
                                                                <span className="text-red-500">No URL</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {isRowMigrated(row.id) ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                    Migrated
                                                                </span>
                                                            ) : isCurrentlyMigrating(row.id) ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                                                                    Migrating...
                                                                </span>
                                                            ) : state.migrationProgress?.errors[row.id] ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={state.migrationProgress.errors[row.id]}>
                                                                    Failed
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            
                            {state.selectedTable && selectedImageColumn && state.rows.length === 0 && !state.loading && (
                                <div className="text-center p-8 border border-gray-200 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    <h3 className="mt-2 text-sm font-medium text-gray-900">No rows found</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        This table doesn&apos;t seem to have any rows with image data.
                                    </p>
                                </div>
                            )}
                            
                            {state.loading && (
                                <div className="flex justify-center items-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                                    <div className="flex flex-col items-center">
                                        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 border-t-indigo-500 animate-spin"></div>
                                        <p className="text-sm text-gray-500">Loading data...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
} 