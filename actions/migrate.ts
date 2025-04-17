'use server';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { 
    SupabaseConfig, 
    CloudflareConfig 
} from '@/lib/storage-utils';
import { z } from 'zod';

// Server-side validation schemas
const ServerSupabaseConfigSchema = z.object({
    supabaseUrl: z.string().url('Invalid Supabase URL'),
    supabaseKey: z.string().min(1, 'Supabase service role key is required'),
    bucketName: z.string().min(1, 'Bucket name is required')
});

const ServerCloudflareConfigSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required'),
    accessKeyId: z.string().min(1, 'Access Key ID is required'),
    secretAccessKey: z.string().min(1, 'Secret Access Key is required'),
    bucketName: z.string().min(1, 'Bucket name is required'),
    publicUrlPattern: z.string().optional(),
    customDomain: z.string().optional(),
});

/**
 * Normalize a path to prevent double slashes and ensure consistent format
 */
function normalizePath(path: string): string {
    // Remove any double slashes and ensure only single slashes are used
    let normalized = path.replace(/\/+/g, '/');
    
    // Remove leading slash if present
    if (normalized.startsWith('/')) {
        normalized = normalized.substring(1);
    }
    
    return normalized;
}

/**
 * Server action to migrate a file from Supabase Storage to Cloudflare R2
 */
export async function migrateFileToR2(
    supabaseConfig: SupabaseConfig,
    cloudflareConfig: CloudflareConfig,
    filePath: string
) {
    try {
        // Normalize the file path
        const normalizedFilePath = normalizePath(filePath);
        console.log(`Processing migration request for file: ${normalizedFilePath}`);
        
        try {
            // Validate Supabase config with server-side schema
            const validSupabaseConfigResult = ServerSupabaseConfigSchema.safeParse(supabaseConfig);
            if (!validSupabaseConfigResult.success) {
                return { 
                    success: false, 
                    error: `Invalid Supabase config: ${validSupabaseConfigResult.error.message}` 
                };
            }
            const validSupabaseConfig = validSupabaseConfigResult.data;
            
            // Validate Cloudflare config with server-side schema
            const validCloudflareConfigResult = ServerCloudflareConfigSchema.safeParse(cloudflareConfig);
            if (!validCloudflareConfigResult.success) {
                return { 
                    success: false, 
                    error: `Invalid Cloudflare config: ${validCloudflareConfigResult.error.message}` 
                };
            }
            const validCloudflareConfig = validCloudflareConfigResult.data;
            
            // Initialize Supabase client
            const supabase = createClient(
                validSupabaseConfig.supabaseUrl,
                validSupabaseConfig.supabaseKey
            );
            
            console.log(`Downloading ${normalizedFilePath} from Supabase bucket: ${validSupabaseConfig.bucketName}`);
            
            // Download file from Supabase
            const { data, error } = await supabase.storage
                .from(validSupabaseConfig.bucketName)
                .download(normalizedFilePath);
            
            if (error) {
                console.error(`Error downloading from Supabase: ${error.message}`);
                return { 
                    success: false, 
                    error: `Error downloading file: ${error.message}` 
                };
            }
            
            if (!data) {
                console.error(`File could not be downloaded: ${normalizedFilePath}`);
                return { 
                    success: false, 
                    error: 'File could not be downloaded' 
                };
            }
            
            // Determine content type based on file extension
            const contentType = getContentType(normalizedFilePath);
            
            console.log(`Uploading ${normalizedFilePath} to Cloudflare R2 bucket: ${validCloudflareConfig.bucketName}`);
            
            // Initialize R2 client
            const r2Client = new S3Client({
                region: 'auto',
                endpoint: `https://${validCloudflareConfig.accountId}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: validCloudflareConfig.accessKeyId,
                    secretAccessKey: validCloudflareConfig.secretAccessKey,
                },
            });
            
            // Upload to R2
            try {
                const arrayBuffer = await data.arrayBuffer();
                
                const command = new PutObjectCommand({
                    Bucket: validCloudflareConfig.bucketName,
                    Key: normalizedFilePath,
                    Body: Buffer.from(arrayBuffer),
                    ContentType: contentType
                });
                
                await r2Client.send(command);
                
                console.log(`Successfully migrated ${normalizedFilePath}`);
                
                // Generate the URL with the custom domain if available
                let fileUrl;
                if (validCloudflareConfig.customDomain) {
                    fileUrl = `https://${validCloudflareConfig.customDomain}/${normalizedFilePath}`;
                } else {
                    fileUrl = `https://${validCloudflareConfig.bucketName}.${validCloudflareConfig.accountId}.r2.cloudflarestorage.com/${normalizedFilePath}`;
                }
                
                return { 
                    success: true,
                    url: fileUrl,
                    message: `Successfully migrated ${normalizedFilePath}` 
                };
            } catch (r2Error) {
                console.error(`R2 upload error: ${r2Error instanceof Error ? r2Error.message : 'Unknown R2 error'}`);
                return { 
                    success: false, 
                    error: `Failed to upload to R2: ${r2Error instanceof Error ? r2Error.message : 'Unknown R2 error'}` 
                };
            }
        } catch (error) {
            console.error('Error processing file migration:', error);
            
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    } catch (error) {
        console.error('Server error during migration:', error);
        
        return { 
            success: false, 
            error: 'Server error processing your request' 
        };
    }
}

// Helper function to determine content type
function getContentType(path: string): string {
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