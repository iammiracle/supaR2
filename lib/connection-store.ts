import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { 
    SupabaseConfig, 
    CloudflareConfig, 
    saveSupabaseConfig, 
    saveCloudflareConfig,
    CloudflareConfigSchema,
    initSupabaseClientForAuth
} from './storage-utils';
import { connectToSupabaseStorage, connectToSupabaseTable } from '@/actions/supabase';
import { connectToR2 } from '@/actions/r2';

interface ConnectionState {
    // Configuration
    supabaseConfig: SupabaseConfig;
    cloudflareConfig: CloudflareConfig;
    
    // Connection states
    supabaseConnected: boolean;
    cloudflareConnected: boolean;
    
    // UI states
    availableBuckets: string[];
    migrationMode: "file" | "table";
    tempMigrationMode: "file" | "table";
    
    // Editing states (for forms/dialogs)
    editingSupabaseConfig: SupabaseConfig;
    editingCloudflareConfig: CloudflareConfig;
    openSupabaseDialog: boolean;
    openCloudflareDialog: boolean;
    
    // Client detection (to prevent hydration issues)
    isClientSide: boolean;
    
    // Actions
    setSupabaseConfig: (config: Partial<SupabaseConfig>) => void;
    setCloudflareConfig: (config: Partial<CloudflareConfig>) => void;
    setEditingSupabaseConfig: (config: Partial<SupabaseConfig>) => void;
    setEditingCloudflareConfig: (config: Partial<CloudflareConfig>) => void;
    applyEditingSupabaseConfig: () => void;
    applyEditingCloudflareConfig: () => void;
    setMigrationMode: (mode: "file" | "table") => void;
    setTempMigrationMode: (mode: "file" | "table") => void;
    toggleSupabaseDialog: (open?: boolean) => void;
    toggleCloudflareDialog: (open?: boolean) => void;
    resetSupabaseConfig: () => void;
    resetCloudflareConfig: () => void;
    setClientSide: (isClient: boolean) => void;
    setAvailableBuckets: (buckets: string[]) => void;
    setSupabaseConnected: (connected: boolean) => void;
    setCloudflareConnected: (connected: boolean) => void;
    
    // Complex actions
    connectToSupabase: () => Promise<void>;
    connectToCloudflare: () => Promise<void>;
}

const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
    supabaseUrl: '',
    supabaseKey: '',
    bucketName: '',
};

const DEFAULT_CLOUDFLARE_CONFIG: CloudflareConfig = {
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: '',
    customDomain: '',
};

export const useConnectionStore = create<ConnectionState>()(
    persist(
        (set, get) => ({
            // Initial states
            supabaseConfig: DEFAULT_SUPABASE_CONFIG,
            cloudflareConfig: DEFAULT_CLOUDFLARE_CONFIG,
            editingSupabaseConfig: DEFAULT_SUPABASE_CONFIG,
            editingCloudflareConfig: DEFAULT_CLOUDFLARE_CONFIG,
            supabaseConnected: false,
            cloudflareConnected: false,
            availableBuckets: [],
            migrationMode: "file",
            tempMigrationMode: "file",
            openSupabaseDialog: false,
            openCloudflareDialog: false,
            isClientSide: false,
            
            // Basic actions
            setSupabaseConfig: (config) =>
                set((state) => ({
                    supabaseConfig: { ...state.supabaseConfig, ...config },
                })),
            
            setCloudflareConfig: (config) =>
                set((state) => ({
                    cloudflareConfig: { ...state.cloudflareConfig, ...config },
                })),
            
            setEditingSupabaseConfig: (config) =>
                set((state) => ({
                    editingSupabaseConfig: { ...state.editingSupabaseConfig, ...config },
                })),
            
            setEditingCloudflareConfig: (config) =>
                set((state) => ({
                    editingCloudflareConfig: { ...state.editingCloudflareConfig, ...config },
                })),
            
            applyEditingSupabaseConfig: () =>
                set((state) => ({
                    supabaseConfig: { ...state.supabaseConfig, ...state.editingSupabaseConfig },
                })),
            
            applyEditingCloudflareConfig: () =>
                set((state) => ({
                    cloudflareConfig: { ...state.cloudflareConfig, ...state.editingCloudflareConfig },
                })),
            
            setMigrationMode: (mode) => {
                set({ migrationMode: mode });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('migration_mode', mode);
                }
            },
            
            setTempMigrationMode: (mode) => 
                set({ tempMigrationMode: mode }),
            
            toggleSupabaseDialog: (open) => 
                set((state) => ({
                    openSupabaseDialog: open !== undefined ? open : !state.openSupabaseDialog,
                    // Reset editing config to current config when opening dialog
                    editingSupabaseConfig: open !== false ? { ...state.supabaseConfig } : state.editingSupabaseConfig,
                })),
            
            toggleCloudflareDialog: (open) => 
                set((state) => ({
                    openCloudflareDialog: open !== undefined ? open : !state.openCloudflareDialog,
                    // Reset editing config to current config when opening dialog
                    editingCloudflareConfig: open !== false ? { ...state.cloudflareConfig } : state.editingCloudflareConfig,
                })),
            
            resetSupabaseConfig: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('supabase_config');
                }
                set({
                    supabaseConfig: DEFAULT_SUPABASE_CONFIG,
                    supabaseConnected: false,
                    availableBuckets: [],
                });
            },
            
            resetCloudflareConfig: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('cloudflare_config');
                }
                set({
                    cloudflareConfig: DEFAULT_CLOUDFLARE_CONFIG,
                    cloudflareConnected: false,
                });
            },
            
            setClientSide: (isClient) => 
                set({ isClientSide: isClient }),
            
            setAvailableBuckets: (buckets) => 
                set({ availableBuckets: buckets }),
            
            setSupabaseConnected: (connected) => 
                set({ supabaseConnected: connected }),
            
            setCloudflareConnected: (connected) => 
                set({ cloudflareConnected: connected }),
            
            // Complex actions
            connectToSupabase: async () => {
                const state = get();
                
                try {
                    // Validate that we have required credentials from the editing state
                    if (!state.editingSupabaseConfig.supabaseUrl || !state.editingSupabaseConfig.supabaseKey) {
                        toast.error("Supabase URL and API Key are required");
                        return;
                    }
                    
                    // Also validate bucket name from editing state
                    if (!state.editingSupabaseConfig.bucketName) {
                        toast.error("Bucket name is required");
                        return;
                    }
                    
                    // Update migration mode
                    state.setMigrationMode(state.tempMigrationMode);
                    
                    // Apply the editing config to the actual config
                    state.applyEditingSupabaseConfig();
                    
                    // Choose the appropriate server action based on migration mode
                    let result;
                    try {
                        if (state.tempMigrationMode === 'table') {
                            // Use the table validation for table mode
                            result = await connectToSupabaseTable(
                                state.editingSupabaseConfig.supabaseUrl,
                                state.editingSupabaseConfig.supabaseKey,
                                state.editingSupabaseConfig.bucketName
                            );
                        } else {
                            // Use the storage validation for file mode
                            result = await connectToSupabaseStorage(
                                state.editingSupabaseConfig.supabaseUrl,
                                state.editingSupabaseConfig.supabaseKey,
                                state.editingSupabaseConfig.bucketName
                            );
                        }
                    } catch (error) {
                        console.error("Error connecting to Supabase resource:", error);
                        // Provide a more helpful error message, especially for empty error objects
                        let errorMessage = "Failed to connect";
                        
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        } else if (state.tempMigrationMode === 'table') {
                            errorMessage = `Table "${state.editingSupabaseConfig.bucketName}" may not exist or you don't have permission to access it.`;
                        } else {
                            errorMessage = `Storage bucket "${state.editingSupabaseConfig.bucketName}" may not exist or you don't have permission to access it.`;
                        }
                        
                        toast.error(errorMessage);
                        set({ supabaseConnected: false });
                        return;
                    }
                    
                    if (!result.success) {
                        // Enhance the error message for failed connections
                        let errorMessage = result.error || 'Failed to connect';
                        
                        // Add more context if the error is empty or generic
                        if (!result.error || result.error === '{}') {
                            if (state.tempMigrationMode === 'table') {
                                errorMessage = `Table "${state.editingSupabaseConfig.bucketName}" may not exist or you don't have permission to access it.`;
                            } else {
                                errorMessage = `Storage bucket "${state.editingSupabaseConfig.bucketName}" may not exist or you don't have permission to access it.`;
                            }
                        }
                        
                        toast.error(errorMessage);
                        set({ supabaseConnected: false });
                        return;
                    }
                    
                    // Fetch available buckets for the dropdown only in file mode
                    if (state.tempMigrationMode === 'file') {
                        try {
                            // Use the auth-only client just for listing buckets
                            const supabase = initSupabaseClientForAuth({
                                supabaseUrl: state.editingSupabaseConfig.supabaseUrl,
                                supabaseKey: state.editingSupabaseConfig.supabaseKey
                            });
                            
                            // List available buckets
                            const { data, error } = await supabase.storage.listBuckets();
                            
                            if (error) {
                                // This should rarely happen since we already validated the connection
                                console.error("Error listing buckets:", error);
                            } else if (data) {
                                // Set available buckets
                                set({ availableBuckets: data.map(bucket => bucket.name) });
                            }
                        } catch (bucketError) {
                            console.error("Error listing buckets:", bucketError);
                            // Don't fail the connection for this, just log it
                        }
                    } else {
                        // In table mode, we don't load available buckets from storage
                        set({ availableBuckets: [] });
                    }
                    
                    // If we have a result, and it's successful, close the dialog and save the config
                    saveSupabaseConfig(state.supabaseConfig);
                    
                    // Success message
                    if (state.tempMigrationMode === 'table') {
                        toast.success(`Connected to Supabase table: ${state.supabaseConfig.bucketName}`);
                    } else {
                        toast.success(`Connected to Supabase bucket: ${state.supabaseConfig.bucketName}`);
                    }
                    
                    // Update connection state
                    set({ 
                        supabaseConnected: true,
                        openSupabaseDialog: false
                    });
                } catch (error) {
                    console.error("Error in connectToSupabase:", error);
                    toast.error("An unexpected error occurred while connecting to Supabase");
                    set({ supabaseConnected: false });
                }
            },
            
            connectToCloudflare: async () => {
                const state = get();
                
                try {
                    // Validate Cloudflare config using Zod
                    const validationResult = CloudflareConfigSchema.safeParse(state.editingCloudflareConfig);
                    
                    if (!validationResult.success) {
                        // Extract error message from Zod validation result
                        const errors = validationResult.error.errors;
                        const errorMessage = errors.length > 0 
                            ? errors[0].message 
                            : "Invalid Cloudflare configuration";
                        
                        toast.error(errorMessage);
                        return;
                    }
                    
                    // Apply the editing config to the actual config
                    state.applyEditingCloudflareConfig();
                    
                    // Try connecting to R2
                    try {
                        const result = await connectToR2(
                            state.cloudflareConfig.accountId,
                            state.cloudflareConfig.accessKeyId,
                            state.cloudflareConfig.secretAccessKey,
                            state.cloudflareConfig.bucketName
                        );
                        
                        if (!result.success) {
                            toast.error(result.error || "Failed to connect to Cloudflare R2");
                            set({ cloudflareConnected: false });
                            return;
                        }
                    } catch (error) {
                        console.error("Error connecting to Cloudflare R2:", error);
                        let errorMessage = "Failed to connect to Cloudflare R2";
                        
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        }
                        
                        toast.error(errorMessage);
                        set({ cloudflareConnected: false });
                        return;
                    }
                    
                    // If connection is successful, save the config
                    saveCloudflareConfig(state.cloudflareConfig);
                    
                    // Update UI state
                    toast.success(`Connected to Cloudflare R2 bucket: ${state.cloudflareConfig.bucketName}`);
                    set({ 
                        cloudflareConnected: true,
                        openCloudflareDialog: false
                    });
                } catch (error) {
                    console.error("Error in connectToCloudflare:", error);
                    toast.error("An unexpected error occurred while connecting to Cloudflare R2");
                    set({ cloudflareConnected: false });
                }
            }
        }),
        {
            name: 'connection-storage',
            partialize: (state) => ({
                // Only persist these values
                supabaseConfig: state.supabaseConfig,
                cloudflareConfig: state.cloudflareConfig,
                supabaseConnected: state.supabaseConnected,
                cloudflareConnected: state.cloudflareConnected,
                migrationMode: state.migrationMode,
            }),
        }
    )
); 