import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { 
    SupabaseConfig, 
    CloudflareConfig, 
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
    tableName: '',
    primaryKeyColumn: 'id',
};

const DEFAULT_CLOUDFLARE_CONFIG: CloudflareConfig = {
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: '',
    publicUrlPattern: '',
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
            },
            
            setTempMigrationMode: (mode) => 
                set({ tempMigrationMode: mode }),
            
            toggleSupabaseDialog: (open) => 
                set((state) => ({
                    openSupabaseDialog: open !== undefined ? open : !state.openSupabaseDialog,
                    editingSupabaseConfig: open !== false ? { ...state.supabaseConfig } : state.editingSupabaseConfig,
                    tempMigrationMode: open !== false ? state.migrationMode : state.tempMigrationMode,
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
            
            setClientSide: (isClient) => {
                if (isClient && typeof window !== 'undefined') {
                    localStorage.removeItem('supabase_config');
                    localStorage.removeItem('cloudflare_config');
                    localStorage.removeItem('migration_mode');

                    const persistedState = localStorage.getItem('connection-storage');
                    if (persistedState) {
                        try {
                            const parsed = JSON.parse(persistedState) as { state?: Partial<ConnectionState> };
                            const migrationMode = parsed.state?.migrationMode === 'table' ? 'table' : 'file';
                            localStorage.setItem('connection-storage', JSON.stringify({
                                state: { migrationMode },
                                version: 2,
                            }));
                        } catch {
                            localStorage.removeItem('connection-storage');
                        }
                    }
                }
                set({ isClientSide: isClient });
            },
            
            setAvailableBuckets: (buckets) => 
                set({ availableBuckets: buckets }),
            
            setSupabaseConnected: (connected) => 
                set({ supabaseConnected: connected }),
            
            setCloudflareConnected: (connected) => 
                set({ cloudflareConnected: connected }),
            
            // Complex actions
            connectToSupabase: async () => {
                const state = get();
                const mode = state.tempMigrationMode;
                const nextConfig: SupabaseConfig = {
                    ...state.editingSupabaseConfig,
                    bucketName: state.editingSupabaseConfig.bucketName.trim(),
                    tableName: state.editingSupabaseConfig.tableName?.trim() || '',
                    primaryKeyColumn: state.editingSupabaseConfig.primaryKeyColumn?.trim() || 'id',
                };
                
                try {
                    if (!nextConfig.supabaseUrl || !nextConfig.supabaseKey) {
                        toast.error("Supabase URL and API Key are required");
                        return;
                    }
                    
                    if (!nextConfig.bucketName) {
                        toast.error("Storage bucket name is required");
                        return;
                    }

                    if (mode === 'table' && !nextConfig.tableName) {
                        toast.error("Table name is required for table migrations");
                        return;
                    }
                    
                    try {
                        const storageResult = await connectToSupabaseStorage(
                            nextConfig.supabaseUrl,
                            nextConfig.supabaseKey,
                            nextConfig.bucketName
                        );

                        if (!storageResult.success) {
                            toast.error(storageResult.error || "Storage bucket not accessible");
                            set({ supabaseConnected: false });
                            return;
                        }

                        if (mode === 'table') {
                            const tableResult = await connectToSupabaseTable(
                                nextConfig.supabaseUrl,
                                nextConfig.supabaseKey,
                                nextConfig.tableName as string
                            );

                            if (!tableResult.success) {
                                toast.error(tableResult.error || "Table not accessible");
                                set({ supabaseConnected: false });
                                return;
                            }
                        }
                    } catch (error) {
                        console.error("Error connecting to Supabase resource:", error);
                        let errorMessage = "Failed to connect";
                        
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        } else if (mode === 'table') {
                            errorMessage = `Storage bucket "${nextConfig.bucketName}" or table "${nextConfig.tableName}" may not be accessible.`;
                        } else {
                            errorMessage = `Storage bucket "${nextConfig.bucketName}" may not be accessible.`;
                        }
                        
                        toast.error(errorMessage);
                        set({ supabaseConnected: false });
                        return;
                    }
                    
                    if (mode === 'file') {
                        try {
                            const supabase = initSupabaseClientForAuth({
                                supabaseUrl: nextConfig.supabaseUrl,
                                supabaseKey: nextConfig.supabaseKey
                            });
                            
                            const { data, error } = await supabase.storage.listBuckets();
                            
                            if (error) {
                                console.error("Error listing buckets:", error);
                            } else if (data) {
                                set({ availableBuckets: data.map(bucket => bucket.name) });
                            }
                        } catch (bucketError) {
                            console.error("Error listing buckets:", bucketError);
                        }
                    } else {
                        set({ availableBuckets: [] });
                    }
                    
                    if (mode === 'table') {
                        toast.success(`Connected to Supabase table: ${nextConfig.tableName}`);
                    } else {
                        toast.success(`Connected to Supabase bucket: ${nextConfig.bucketName}`);
                    }
                    
                    set({ 
                        supabaseConfig: nextConfig,
                        migrationMode: mode,
                        tempMigrationMode: mode,
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
                    const validationResult = CloudflareConfigSchema.safeParse(state.editingCloudflareConfig);
                    
                    if (!validationResult.success) {
                        const errors = validationResult.error.errors;
                        const errorMessage = errors.length > 0 
                            ? errors[0].message 
                            : "Invalid Cloudflare configuration";
                        
                        toast.error(errorMessage);
                        return;
                    }
                    
                    const nextConfig = validationResult.data;
                    
                    try {
                        const result = await connectToR2(
                            nextConfig.accountId,
                            nextConfig.accessKeyId,
                            nextConfig.secretAccessKey,
                            nextConfig.bucketName
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
                    
                    toast.success(`Connected to Cloudflare R2 bucket: ${nextConfig.bucketName}`);
                    set({ 
                        cloudflareConfig: nextConfig,
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
            version: 2,
            partialize: (state) => ({
                migrationMode: state.migrationMode,
            }),
            migrate: (persistedState) => {
                const state = persistedState as Partial<ConnectionState> | undefined;
                return {
                    migrationMode: state?.migrationMode === 'table' ? 'table' : 'file',
                };
            },
        }
    )
); 
