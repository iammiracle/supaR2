import { SupabaseClient } from '@supabase/supabase-js';
import { 
    S3Client, 
    ListObjectsV2Command,
    HeadObjectCommand
} from '@aws-sdk/client-s3';
import { SupabaseConfig, CloudflareConfig, initSupabaseClient, initCloudflareR2Client } from './storage-utils';
import { migrateFileToR2 } from '@/actions/migrate';

export interface MigrationFile {
    path: string;
    size: number;
    lastModified?: string;
    selected?: boolean;
}

export interface MigrationProgress {
    total: number;
    completed: number;
    failed: number;
    inProgress: boolean;
    errors: Record<string, string>;
}

export interface MigrationStats {
    totalSize: number;
    totalFiles: number;
}

export class MigrationService {
    private supabase: SupabaseClient;
    private r2Client?: S3Client;
    private supabaseConfig: SupabaseConfig;
    private cloudflareConfig: Partial<CloudflareConfig>;
    private progress: MigrationProgress = {
        total: 0,
        completed: 0,
        failed: 0,
        inProgress: false,
        errors: {}
    };

    constructor(supabaseConfig: SupabaseConfig, cloudflareConfig: Partial<CloudflareConfig>) {
        this.supabaseConfig = supabaseConfig;
        this.cloudflareConfig = cloudflareConfig as CloudflareConfig;
        
        this.supabase = initSupabaseClient(supabaseConfig);
        
        // Only initialize R2 client if we have all required config fields
        if (cloudflareConfig.accountId && 
            cloudflareConfig.accessKeyId && 
            cloudflareConfig.secretAccessKey && 
            cloudflareConfig.bucketName) {
            this.r2Client = initCloudflareR2Client(cloudflareConfig as CloudflareConfig);
        }
    }

    /**
     * Normalize a path to prevent double slashes and ensure consistent format
     */
    private normalizePath(path: string): string {
        // Remove any double slashes and ensure only single slashes are used
        let normalized = path.replace(/\/+/g, '/');
        
        // Remove leading slash if present
        if (normalized.startsWith('/')) {
            normalized = normalized.substring(1);
        }
        
        return normalized;
    }

    /**
     * Check if a path should be skipped (test data, example data, etc.)
     */
    private shouldSkipPath(path: string): boolean {
        // Skip paths containing test or example data indicators
        const skipPatterns = [
            '.emptyFolderPlaceholder',
            'test-',
            'mock-',
            'example',
            '/example',
            '/examples/',
            'sample-',
            '/sample/',
            '/test/',
            '/testing/'
        ];
        
        return skipPatterns.some(pattern => path.includes(pattern));
    }

    /**
     * List all files in the Supabase bucket
     */
    async listFiles(path = ''): Promise<MigrationFile[]> {
        try {
            // Validate bucket name exists before attempting to list
            if (!this.supabaseConfig.bucketName) {
                throw new Error("Bucket name is required");
            }
            
            // Normalize the path before listing
            const normalizedPath = this.normalizePath(path);
            
            // Skip test/example directories entirely
            if (this.shouldSkipPath(normalizedPath)) {
                return [];
            }
            
            const { data, error } = await this.supabase.storage
                .from(this.supabaseConfig.bucketName)
                .list(normalizedPath);
                
            if (error) {
                if (error.message.includes("not found") || error.message.includes("does not exist")) {
                    throw new Error(`Bucket "${this.supabaseConfig.bucketName}" does not exist or is not accessible`);
                }
                throw error;
            }
            
            if (!data) {
                throw new Error(`No data returned from bucket "${this.supabaseConfig.bucketName}"`);
            }
            
            // Filter out folders and map to MigrationFile objects
            const files: MigrationFile[] = [];
            
            for (const item of data) {
                // Skip files and folders that should be excluded
                const itemPath = normalizedPath ? `${normalizedPath}/${item.name}` : item.name;
                if (this.shouldSkipPath(itemPath)) {
                    continue;
                }
                
                if (!item.id) {
                    // This is a folder
                    // Join paths properly to avoid double slashes
                    const subPath = normalizedPath ? `${normalizedPath}/${item.name}` : item.name;
                    const subFiles = await this.listFiles(subPath);
                    files.push(...subFiles);
                } else {
                    // For files, construct the full path correctly
                    const fullPath = normalizedPath ? `${normalizedPath}/${item.name}` : item.name;
                    files.push({
                        path: fullPath,
                        size: item.metadata?.size || 0,
                        lastModified: item.metadata?.lastModified,
                        selected: true
                    });
                }
            }
            
            return files;
        } catch (error) {
            console.error('Error listing files:', error);
            throw error;
        }
    }

    /**
     * List files in Cloudflare R2 bucket
     */
    async listR2Files(prefix = ''): Promise<MigrationFile[]> {
        try {
            // Check if r2Client is initialized
            if (!this.r2Client) {
                throw new Error("Cloudflare R2 client is not initialized. Please connect to Cloudflare R2 first.");
            }
            
            const command = new ListObjectsV2Command({
                Bucket: this.cloudflareConfig.bucketName as string,
                Prefix: prefix
            });
            
            const response = await this.r2Client.send(command);
            
            if (!response.Contents) {
                return [];
            }
            
            return response.Contents.map(item => ({
                path: item.Key || '',
                size: item.Size || 0,
                lastModified: item.LastModified?.toISOString()
            }));
        } catch (error) {
            console.error('Error listing R2 files:', error);
            throw error;
        }
    }

    /**
     * Check if a file exists in R2
     */
    async fileExistsInR2(path: string): Promise<boolean> {
        try {
            // Check if r2Client is initialized
            if (!this.r2Client) {
                throw new Error("Cloudflare R2 client is not initialized. Please connect to Cloudflare R2 first.");
            }
            
            // Normalize the path
            const normalizedPath = this.normalizePath(path);
            
            const command = new HeadObjectCommand({
                Bucket: this.cloudflareConfig.bucketName as string,
                Key: normalizedPath,
            });
            
            await this.r2Client.send(command);
            return true;
        } catch (error) {
            if (error instanceof Error && error.message.includes("not initialized")) {
                throw error;
            }
            return false;
        }
    }

    /**
     * Download a file from Supabase
     */
    private async downloadFromSupabase(path: string): Promise<ArrayBuffer> {
        // Normalize the path
        const normalizedPath = this.normalizePath(path);
        
        const { data, error } = await this.supabase.storage
            .from(this.supabaseConfig.bucketName)
            .download(normalizedPath);
            
        if (error) {
            throw error;
        }
        
        return await data.arrayBuffer();
    }

    /**
     * Upload a file to R2 via the server action
     */
    private async uploadToR2(path: string): Promise<void> {
        const normalizedPath = this.normalizePath(path);
        try {
            console.log(`Preparing to upload ${normalizedPath} to R2 via server action`);
            
            try {
                const result = await migrateFileToR2(
                    this.supabaseConfig,
                    this.cloudflareConfig as CloudflareConfig,
                    normalizedPath
                );
                
                if (!result.success) {
                    console.error(`Error response for ${normalizedPath}:`, result.error);
                    throw new Error(result.error || 'Failed to upload file to R2');
                }
                
                console.log(`Successfully migrated: ${normalizedPath}`);
            } catch (error) {
                console.error(`Error uploading ${normalizedPath} to R2:`, error);
                throw error;
            }
        } catch (error) {
            console.error(`Error uploading ${normalizedPath} to R2:`, error);
            throw error;
        }
    }

    /**
     * Migrate a single file from Supabase to Cloudflare R2
     */
    private async migrateFile(path: string): Promise<void> {
        try {
            // Skip example or test files
            if (this.shouldSkipPath(path)) {
                console.log(`Skipping example/test file: ${path}`);
                this.progress.completed++;
                return;
            }
            
            // Normalize path
            const normalizedPath = this.normalizePath(path);
            
            // Check if file already exists in R2
            const exists = await this.fileExistsInR2(normalizedPath);
            if (exists) {
                console.log(`File ${normalizedPath} already exists in R2, skipping`);
                this.progress.completed++;
                return;
            }
            
            // No need to download the file here since the API will do it for us
            // Just call the API endpoint to handle the migration
            await this.uploadToR2(normalizedPath);
            
            this.progress.completed++;
        } catch (error) {
            console.error(`Error migrating file ${path}:`, error);
            this.progress.failed++;
            this.progress.errors[path] = error instanceof Error ? error.message : 'Unknown error';
        }
    }

    /**
     * Start migration of selected files
     */
    async migrateFiles(files: MigrationFile[]): Promise<MigrationProgress> {
        if (this.progress.inProgress) {
            throw new Error("Migration already in progress");
        }
        
        // Check if r2Client is initialized
        if (!this.r2Client) {
            throw new Error("Cloudflare R2 client is not initialized. Please connect to Cloudflare R2 first.");
        }
        
        // Reset progress
        this.progress = {
            total: files.length,
            completed: 0,
            failed: 0,
            inProgress: true,
            errors: {}
        };
        
        try {
            // Process files in batches to avoid overwhelming the API
            const batchSize = 5;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                await Promise.all(batch.map(file => this.migrateFile(file.path)));
            }
        } finally {
            this.progress.inProgress = false;
        }
        
        return { ...this.progress };
    }

    /**
     * Get migration progress
     */
    getProgress(): MigrationProgress {
        return { ...this.progress };
    }

    /**
     * Get content type based on file extension
     */
    private getContentType(path: string): string {
        const extension = path.split('.').pop()?.toLowerCase();
        
        const contentTypes: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'mp3': 'audio/mpeg',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'json': 'application/json',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'txt': 'text/plain',
        };
        
        return extension && contentTypes[extension] ? contentTypes[extension] : 'application/octet-stream';
    }
} 