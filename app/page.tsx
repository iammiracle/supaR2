'use client'

import { useReducer, useEffect, useState } from "react";
import Image from "next/image";
import { toast, Toaster } from "sonner";
import FileMigration from "./components/FileMigration";
import TableMigration from "./components/TableMigration";
import {
    SupabaseConfig,
    CloudflareConfig,
    initSupabaseClientForAuth,
    saveSupabaseConfig,
    saveCloudflareConfig,
    loadSupabaseConfig,
    loadCloudflareConfig,
    getSupabaseConfigFromEnv,
    getCloudflareConfigFromEnv,
    CloudflareConfigSchema
} from "../lib/storage-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Define state interface and initial state
interface AppState {
    supabaseConfig: Partial<SupabaseConfig>;
    cloudflareConfig: Partial<CloudflareConfig>;
    supabaseConnected: boolean;
    cloudflareConnected: boolean;
    availableBuckets: string[];
    migrationMode: "file" | "table";
}

const initialState: AppState = {
    supabaseConfig: loadSupabaseConfig() || getSupabaseConfigFromEnv(),
    cloudflareConfig: loadCloudflareConfig() || getCloudflareConfigFromEnv(),
    supabaseConnected: false,
    cloudflareConnected: false,
    availableBuckets: [],
    migrationMode: "file"
};

// Define reducer actions
type Action = 
    | { type: 'SET_SUPABASE_CONFIG', payload: Partial<SupabaseConfig> }
    | { type: 'SET_CLOUDFLARE_CONFIG', payload: Partial<CloudflareConfig> }
    | { type: 'SET_SUPABASE_CONNECTED', payload: boolean }
    | { type: 'SET_CLOUDFLARE_CONNECTED', payload: boolean }
    | { type: 'SET_AVAILABLE_BUCKETS', payload: string[] }
    | { type: 'SET_MIGRATION_MODE', payload: "file" | "table" };

// Reducer function
function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'SET_SUPABASE_CONFIG':
            return { ...state, supabaseConfig: { ...state.supabaseConfig, ...action.payload } };
        case 'SET_CLOUDFLARE_CONFIG':
            return { ...state, cloudflareConfig: { ...state.cloudflareConfig, ...action.payload } };
        case 'SET_SUPABASE_CONNECTED':
            return { ...state, supabaseConnected: action.payload };
        case 'SET_CLOUDFLARE_CONNECTED':
            return { ...state, cloudflareConnected: action.payload };
        case 'SET_AVAILABLE_BUCKETS':
            return { ...state, availableBuckets: action.payload };
        case 'SET_MIGRATION_MODE':
            return { ...state, migrationMode: action.payload };
        default:
            return state;
    }
}

export default function Home() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [openSupabaseDialog, setOpenSupabaseDialog] = useState(false);
    const [openCloudflareDialog, setOpenCloudflareDialog] = useState(false);
    const [tempMigrationMode, setTempMigrationMode] = useState<"file" | "table">("file");
    
    // Reset temp migration mode when dialog opens
    useEffect(() => {
        if (openSupabaseDialog) {
            setTempMigrationMode(state.migrationMode);
        }
    }, [openSupabaseDialog, state.migrationMode]);
    
    // Load saved configurations on mount
    useEffect(() => {
        // Try to load from localStorage first
        const savedSupabaseConfig = loadSupabaseConfig();
        const savedCloudflareConfig = loadCloudflareConfig();
        
        // Load saved migration mode
        const savedMigrationMode = localStorage.getItem('migration_mode');
        if (savedMigrationMode === 'file' || savedMigrationMode === 'table') {
            dispatch({ type: 'SET_MIGRATION_MODE', payload: savedMigrationMode });
            // Also set the temp migration mode to match
            setTempMigrationMode(savedMigrationMode);
        }
        
        // If found in localStorage, use those values
        if (savedSupabaseConfig) {
            dispatch({ type: 'SET_SUPABASE_CONFIG', payload: savedSupabaseConfig });
            dispatch({ type: 'SET_SUPABASE_CONNECTED', payload: true });
        } else {
            // Otherwise, try env vars
            const envSupabaseConfig = getSupabaseConfigFromEnv();
            if (envSupabaseConfig.supabaseUrl && envSupabaseConfig.supabaseKey) {
                dispatch({ type: 'SET_SUPABASE_CONFIG', payload: envSupabaseConfig });
            }
        }
        
        if (savedCloudflareConfig) {
            dispatch({ type: 'SET_CLOUDFLARE_CONFIG', payload: savedCloudflareConfig });
            dispatch({ type: 'SET_CLOUDFLARE_CONNECTED', payload: true });
        } else {
            // Otherwise, try env vars
            const envCloudflareConfig = getCloudflareConfigFromEnv();
            if (envCloudflareConfig.accountId && envCloudflareConfig.accessKeyId && envCloudflareConfig.secretAccessKey) {
                dispatch({ type: 'SET_CLOUDFLARE_CONFIG', payload: envCloudflareConfig });
            }
        }
    }, []);

    const handleSupabaseConnect = async () => {
        try {
            // Validate that we have required credentials
            if (!state.supabaseConfig.supabaseUrl || !state.supabaseConfig.supabaseKey) {
                toast.error("Supabase URL and API Key are required");
                return;
            }
            
            // Also validate bucket name
            if (!state.supabaseConfig.bucketName) {
                toast.error("Bucket name is required");
                return;
            }
            
            // Use the auth-only client for initial validation of credentials
            const supabase = initSupabaseClientForAuth({
                supabaseUrl: state.supabaseConfig.supabaseUrl,
                supabaseKey: state.supabaseConfig.supabaseKey
            });
            
            // Update migration mode in state before saving
            dispatch({ type: 'SET_MIGRATION_MODE', payload: tempMigrationMode });
            
            // Test the connection by listing buckets
            const { data, error } = await supabase.storage.listBuckets();
            
            if (error) {
                // If there's an error, it's likely due to invalid credentials or permissions
                toast.error(`Supabase connection error: ${error.message}`);
                dispatch({ type: 'SET_SUPABASE_CONNECTED', payload: false });
                return;
            }
            
            // Set available buckets
            const bucketNames = data.map(bucket => bucket.name);
            dispatch({ type: 'SET_AVAILABLE_BUCKETS', payload: bucketNames });
            
            // Validate that the specified bucket exists
            const bucketExists = bucketNames.includes(state.supabaseConfig.bucketName);
            if (!bucketExists) {
                toast.error(`Bucket "${state.supabaseConfig.bucketName}" not found in your Supabase project`);
                dispatch({ type: 'SET_SUPABASE_CONNECTED', payload: false });
                return;
            }
            
            // Now test if we can actually list the contents of the specified bucket
            const { error: bucketError } = await supabase.storage
                .from(state.supabaseConfig.bucketName)
                .list();
                
            if (bucketError) {
                toast.error(`Cannot access bucket "${state.supabaseConfig.bucketName}": ${bucketError.message}`);
                dispatch({ type: 'SET_SUPABASE_CONNECTED', payload: false });
                return;
            }
            
            // Everything is valid, mark as connected
            dispatch({ type: 'SET_SUPABASE_CONNECTED', payload: true });
            saveSupabaseConfig(state.supabaseConfig as SupabaseConfig);
            
            // Save mode separately in localStorage
            localStorage.setItem('migration_mode', tempMigrationMode);
            
            setOpenSupabaseDialog(false);
            
            // Show appropriate success message based on migration mode
            if (tempMigrationMode === 'table') {
                toast.success(`Connected to Supabase table: ${state.supabaseConfig.bucketName}`);
            } else {
                toast.success(`Connected to Supabase bucket: ${state.supabaseConfig.bucketName}`);
            }
            
        } catch (error) {
            dispatch({ type: 'SET_SUPABASE_CONNECTED', payload: false });
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            toast.error(`Supabase connection error: ${errorMessage}`);
            console.error("Supabase connection error:", error);
        }
    };

    const handleSelectBucket = (bucketName: string) => {
        // Only update the selected bucket in state, don't auto-connect
        dispatch({ 
            type: 'SET_SUPABASE_CONFIG', 
            payload: { bucketName } 
        });
        
        // Don't set as connected here
        // Don't close dialog
        // Don't show success toast
    };

    const handleCloudflareConnect = async () => {
        try {
            // Validate that we have all required fields
            if (!state.cloudflareConfig.accountId || !state.cloudflareConfig.accessKeyId || 
                !state.cloudflareConfig.secretAccessKey || !state.cloudflareConfig.bucketName) {
                toast.error("All Cloudflare R2 fields are required");
                return;
            }
            
            try {
                // Use the proper configuration validation and test connection
                const validConfig = { ...state.cloudflareConfig } as CloudflareConfig;
                
                // Validate with schema
                CloudflareConfigSchema.parse(validConfig);
                
                // Instead of using the client directly, call our API endpoint
                // This avoids CORS issues when connecting to R2 from the browser
                const response = await fetch('/api/validate-r2', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(validConfig),
                });
                
                const result = await response.json();
                
                if (!response.ok || !result.success) {
                    const errorMessage = result.error || 'Failed to connect to R2 bucket';
                    toast.error(errorMessage);
                    dispatch({ type: 'SET_CLOUDFLARE_CONNECTED', payload: false });
                    return;
                }
                
                // Everything is valid, mark as connected
                dispatch({ type: 'SET_CLOUDFLARE_CONNECTED', payload: true });
                saveCloudflareConfig(validConfig);
                setOpenCloudflareDialog(false);
                toast.success(`Connected to Cloudflare R2 bucket: ${validConfig.bucketName}`);
                
            } catch (error) {
                console.error('Error validating Cloudflare config:', error);
                
                let errorMessage = 'Invalid Cloudflare R2 configuration.';
                
                if (error instanceof Error) {
                    if (error.message.includes('validation')) {
                        errorMessage = 'Invalid Cloudflare R2 configuration format.';
                    } else if (error.message.includes('access') || error.message.includes('permissions')) {
                        errorMessage = 'Access denied to Cloudflare R2. Please check your credentials.';
                    } else if (error.message.includes('network') || error.message.includes('connect')) {
                        errorMessage = 'Network error when connecting to Cloudflare R2. Please check your account ID.';
                    } else {
                        errorMessage = `Error: ${error.message}`;
                    }
                }
                
                dispatch({ type: 'SET_CLOUDFLARE_CONNECTED', payload: false });
                toast.error(errorMessage);
                return;
            }
            
        } catch (error) {
            // Outer catch for any unexpected errors
            dispatch({ type: 'SET_CLOUDFLARE_CONNECTED', payload: false });
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
            toast.error(`Cloudflare R2 error: ${errorMessage}`);
            console.error("Unexpected Cloudflare R2 error:", error);
        }
    };

    // Add a disconnect function
    const handleSupabaseDisconnect = () => {
        // Clear localStorage
        localStorage.removeItem('supabase_config');
        
        // Reset state
        dispatch({ type: 'SET_SUPABASE_CONFIG', payload: {
            supabaseUrl: "",
            supabaseKey: "",
            bucketName: ""
        }});
        dispatch({ type: 'SET_SUPABASE_CONNECTED', payload: false });
        dispatch({ type: 'SET_AVAILABLE_BUCKETS', payload: [] });
        
        toast.success("Disconnected from Supabase");
    };

    const handleCloudflareDisconnect = () => {
        // Clear localStorage
        localStorage.removeItem('cloudflare_config');
        
        // Reset state
        dispatch({ type: 'SET_CLOUDFLARE_CONFIG', payload: {
            accountId: "",
            accessKeyId: "",
            secretAccessKey: "",
            bucketName: ""
        }});
        dispatch({ type: 'SET_CLOUDFLARE_CONNECTED', payload: false });
        
        toast.success("Disconnected from Cloudflare R2");
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Toaster position="top-right" richColors />
            <header className="bg-white border-b border-gray-200">
                <div className="px-4 mx-auto">
                    <div className="flex items-center justify-between h-16">

                        <div className="flex ml-4 mr-auto xl:ml-0">
                            <div className="flex items-center flex-shrink-0">
                                <Image className="block w-auto h-18 lg:hidden" src="/supaR2.png" alt="" width={1000} height={1000} />
                                <Image className="hidden w-auto h-26 lg:block" src="/supaR2.png" alt="" width={1000} height={1000} />
                            </div>
                        </div>

                        <div className="flex-1 hidden max-w-xs ml-40 mr-auto lg:block">
                            <label htmlFor="search" className="sr-only"> Search </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                </div>

                                <input type="search" name="" id="" className="border block w-full py-2 pl-10 border-gray-300 rounded-lg focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm" placeholder="Type to search" />
                            </div>
                        </div>

                        <div className="flex items-center justify-end space-x-6 sm:ml-5">
                            <div className="relative">
                                <button type="button" className="p-1 text-gray-700 transition-all duration-200 bg-white rounded-full hover:text-gray-900 focus:outline-none hover:bg-gray-100">
                                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                    </svg>
                                </button>
                                <span className="inline-flex items-center px-1.5 absolute -top-px -right-1 py-0.5 rounded-full text-xs font-semibold bg-indigo-600 text-white"> 2 </span>
                            </div>

                            <div className="relative">
                                <button type="button" className="p-1 text-gray-700 transition-all duration-200 bg-white rounded-full hover:text-gray-900 focus:outline-none hover:bg-gray-100">
                                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                                    </svg>
                                </button>
                            </div>

                            <button type="button" className="flex items-center max-w-xs rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                                <Image className="object-cover bg-gray-300 rounded-full w-9 h-9" src="https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/2/avatar-male.png" alt="" width={36} height={36} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-6">
                <div className="mt-4 bg-white border border-gray-200 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        {/* Supabase Connection (Left Side) */}
                        <div className="px-4 py-5 sm:p-6 border-b md:border-b-0 md:border-r border-gray-200">
                            <h2 className="text-base font-bold text-gray-900">Supabase Connection</h2>
                            <p className="mt-2 text-sm font-medium text-gray-500">
                                Connect to your Supabase storage bucket to migrate files from.
                            </p>
                            
                            <div className="mt-4">
                                {state.supabaseConnected ? (
                                    <div className="mb-4 p-4 bg-gray-50 rounded-md">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-gray-500">
                                                <div><strong>URL:</strong> {state.supabaseConfig.supabaseUrl}</div>
                                                <div className="mt-2">
                                                    <strong>{state.migrationMode === 'file' ? 'Bucket' : 'Table'}:</strong> {state.supabaseConfig.bucketName}
                                                </div>
                                                <div className="mt-2">
                                                    <strong>Mode:</strong> {state.migrationMode === 'file' ? 'Storage' : 'Table'}
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Connected
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-4 p-4 bg-gray-50 rounded-md">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-gray-500">
                                                Not connected to Supabase
                                            </div>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                Not Connected
                                            </span>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex space-x-2">
                                    <Dialog open={openSupabaseDialog} onOpenChange={setOpenSupabaseDialog}>
                                        <DialogTrigger asChild>
                                            <button
                                                type="button"
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                            >
                                                {state.supabaseConnected ? "Edit Connection" : "Connect to Supabase"}
                                            </button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-lg">
                                            <DialogHeader>
                                                <DialogTitle>Supabase Connection</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div>
                                                    <label htmlFor="supabaseUrl" className="block text-sm font-medium text-gray-700">
                                                        Supabase URL
                                                    </label>
                                                    <input
                                                        type="url"
                                                        id="supabaseUrl"
                                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                        value={state.supabaseConfig.supabaseUrl}
                                                        onChange={(e) => dispatch({ 
                                                            type: 'SET_SUPABASE_CONFIG', 
                                                            payload: { supabaseUrl: e.target.value } 
                                                        })}
                                                        placeholder="https://your-project.supabase.co"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label htmlFor="supabaseKey" className="block text-sm font-medium text-gray-700">
                                                        Supabase Service Role Key
                                                    </label>
                                                    <input
                                                        type="password"
                                                        id="supabaseKey"
                                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                        value={state.supabaseConfig.supabaseKey}
                                                        onChange={(e) => dispatch({ 
                                                            type: 'SET_SUPABASE_CONFIG', 
                                                            payload: { supabaseKey: e.target.value } 
                                                        })}
                                                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                                    />
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        Use your project&apos;s <strong>service role key</strong> from Project Settings &gt; API &gt; Project API keys section
                                                    </p>
                                                </div>
                                                
                                                <div>
                                                    <label htmlFor="imageSourceSelect" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Image Source
                                                    </label>
                                                    <select
                                                        id="imageSourceSelect"
                                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                        value={tempMigrationMode}
                                                        onChange={(e) => setTempMigrationMode(e.target.value as "file" | "table")}
                                                    >
                                                        <option value="file">Storage</option>
                                                        <option value="table">Table</option>
                                                    </select>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        Select where your images are currently stored
                                                    </p>
                                                </div>
                                                
                                                {state.availableBuckets.length > 0 ? (
                                                    <div>
                                                        <label htmlFor="bucketSelector" className="block text-sm font-medium text-gray-700">
                                                            {tempMigrationMode === 'file' ? 'Select Bucket' : 'Select Table'}
                                                        </label>
                                                        <select
                                                            id="bucketSelector"
                                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                            value={state.supabaseConfig.bucketName || ''}
                                                            onChange={(e) => handleSelectBucket(e.target.value)}
                                                        >
                                                            <option value="" disabled>
                                                                {tempMigrationMode === 'file' ? 'Select a bucket' : 'Select a table'}
                                                            </option>
                                                            {state.availableBuckets.map(bucketName => (
                                                                <option key={bucketName} value={bucketName}>
                                                                    {bucketName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : state.supabaseConfig.supabaseUrl && state.supabaseConfig.supabaseKey ? (
                                                    <div>
                                                        <label htmlFor="bucketName" className="block text-sm font-medium text-gray-700">
                                                            {tempMigrationMode === 'file' ? 'Bucket Name' : 'Table Name'}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            id="bucketName"
                                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                            value={state.supabaseConfig.bucketName || ''}
                                                            onChange={(e) => dispatch({ 
                                                                type: 'SET_SUPABASE_CONFIG', 
                                                                payload: { bucketName: e.target.value } 
                                                            })}
                                                            placeholder={tempMigrationMode === 'file' ? "your-bucket-name" : "your-table-name"}
                                                        />
                                                        <p className="mt-1 text-xs text-gray-500">
                                                            {tempMigrationMode === 'file' 
                                                                ? 'Enter the name of your existing Supabase storage bucket'
                                                                : 'Enter the name of your database table with image URLs'}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-500 py-2">
                                                        After connecting, you&apos;ll be able to select from available {tempMigrationMode === 'file' ? 'buckets' : 'tables'}.
                                                    </div>
                                                )}
                                                
                                                <div className="pt-4 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleSupabaseConnect();
                                                        }}
                                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                    >
                                                        {state.supabaseConnected ? "Update Connection" : "Connect"}
                                                    </button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    
                                    {state.supabaseConnected && (
                                        <button
                                            type="button"
                                            onClick={handleSupabaseDisconnect}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Cloudflare R2 Connection (Right Side) */}
                        <div className="px-4 py-5 sm:p-6">
                            <h2 className="text-base font-bold text-gray-900">Cloudflare R2 Connection</h2>
                            <p className="mt-2 text-sm font-medium text-gray-500">
                                Connect to your Cloudflare R2 bucket to migrate files to.
                            </p>
                            
                            <div className="mt-4">
                                {state.cloudflareConnected ? (
                                    <div className="mb-4 p-4 bg-gray-50 rounded-md">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-gray-500">
                                                <div><strong>Account ID:</strong> {state.cloudflareConfig.accountId}</div>
                                                <div className="mt-2"><strong>Bucket:</strong> {state.cloudflareConfig.bucketName}</div>
                                                <div className="mt-2"><strong>Custom Domain:</strong> {state.cloudflareConfig.customDomain}</div>
                                            </div>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Connected
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-4 p-4 bg-gray-50 rounded-md">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-gray-500">
                                                Not connected to Cloudflare R2
                                            </div>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                Not Connected
                                            </span>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex space-x-2">
                                    <Dialog open={openCloudflareDialog} onOpenChange={setOpenCloudflareDialog}>
                                        <DialogTrigger asChild>
                                            <button
                                                type="button"
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                            >
                                                {state.cloudflareConnected ? "Edit Connection" : "Connect to Cloudflare R2"}
                                            </button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-lg">
                                            <DialogHeader>
                                                <DialogTitle>Cloudflare R2 Connection</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div>
                                                    <label htmlFor="accountId" className="block text-sm font-medium text-gray-700">
                                                        Account ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="accountId"
                                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                        value={state.cloudflareConfig.accountId}
                                                        onChange={(e) => dispatch({ 
                                                            type: 'SET_CLOUDFLARE_CONFIG', 
                                                            payload: { accountId: e.target.value } 
                                                        })}
                                                        placeholder="your-account-id"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label htmlFor="accessKeyId" className="block text-sm font-medium text-gray-700">
                                                        Access Key ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="accessKeyId"
                                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                        value={state.cloudflareConfig.accessKeyId}
                                                        onChange={(e) => dispatch({ 
                                                            type: 'SET_CLOUDFLARE_CONFIG', 
                                                            payload: { accessKeyId: e.target.value } 
                                                        })}
                                                        placeholder="your-access-key-id"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label htmlFor="secretAccessKey" className="block text-sm font-medium text-gray-700">
                                                        Secret Access Key
                                                    </label>
                                                    <input
                                                        type="password"
                                                        id="secretAccessKey"
                                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                        value={state.cloudflareConfig.secretAccessKey}
                                                        onChange={(e) => dispatch({ 
                                                            type: 'SET_CLOUDFLARE_CONFIG', 
                                                            payload: { secretAccessKey: e.target.value } 
                                                        })}
                                                        placeholder="your-secret-access-key"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label htmlFor="r2BucketName" className="block text-sm font-medium text-gray-700">
                                                        Bucket Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="r2BucketName"
                                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                        value={state.cloudflareConfig.bucketName}
                                                        onChange={(e) => dispatch({ 
                                                            type: 'SET_CLOUDFLARE_CONFIG', 
                                                            payload: { bucketName: e.target.value } 
                                                        })}
                                                        placeholder="your-r2-bucket-name"
                                                    />
                                                </div>

                                                <div>
                                                    <label htmlFor="customDomain" className="block text-sm font-medium text-gray-700">
                                                        Custom Domain (Optional)
                                                    </label>
                                                    <div className="mt-1 flex rounded-md shadow-sm">
                                                        <span className="inline-flex items-center px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                                                            https://
                                                        </span>
                                                        <input
                                                            type="text"
                                                            id="customDomain"
                                                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                            value={state.cloudflareConfig.customDomain || ''}
                                                            onChange={(e) => dispatch({ 
                                                                type: 'SET_CLOUDFLARE_CONFIG', 
                                                                payload: { customDomain: e.target.value } 
                                                            })}
                                                            placeholder="comechop"
                                                        />
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500">Enter your domain name without https:// prefix</p>
                                                </div>
                                                
                                                
                                                
                                                <div className="pt-4 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={handleCloudflareConnect}
                                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                    >
                                                        {state.cloudflareConnected ? "Update Connection" : "Connect"}
                                                    </button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    
                                    {state.cloudflareConnected && (
                                        <button
                                            type="button"
                                            onClick={handleCloudflareDisconnect}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {state.supabaseConnected && state.migrationMode === "file" && (
                    <FileMigration 
                        supabaseConfig={state.supabaseConfig as SupabaseConfig}
                        cloudflareConfig={state.cloudflareConfig as CloudflareConfig}
                        isSupabaseConnected={state.supabaseConnected}
                        isCloudflareConnected={state.cloudflareConnected}
                    />
                )}

                {state.supabaseConnected && state.migrationMode === "table" && (
                    <TableMigration 
                        supabaseConfig={state.supabaseConfig as SupabaseConfig}
                        cloudflareConfig={state.cloudflareConfig as CloudflareConfig}
                        isSupabaseConnected={state.supabaseConnected}
                        isCloudflareConnected={state.cloudflareConnected}
                    />
                )}
            </div>
        </div>
    );
}
