import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { SupabaseConfigSchema, CloudflareConfigSchema } from '@/lib/storage-utils';

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supabaseConfig, cloudflareConfig, filePath } = body;
    
    // Validate configs
    if (!supabaseConfig || !cloudflareConfig || !filePath) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' }, 
        { status: 400 }
      );
    }
    
    // Normalize the file path
    const normalizedFilePath = normalizePath(filePath);
    console.log(`Processing migration request for file: ${normalizedFilePath}`);
    
    try {
      // Validate Supabase config
      const validSupabaseConfig = SupabaseConfigSchema.parse(supabaseConfig);
      
      // Validate Cloudflare config
      const validCloudflareConfig = CloudflareConfigSchema.parse(cloudflareConfig);
      
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
        return NextResponse.json({ 
          success: false, 
          error: `Error downloading file: ${error.message}` 
        }, { status: 404 });
      }
      
      if (!data) {
        console.error(`File could not be downloaded: ${normalizedFilePath}`);
        return NextResponse.json({ 
          success: false, 
          error: 'File could not be downloaded' 
        }, { status: 404 });
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
        
        return NextResponse.json({ 
          success: true,
          url: fileUrl,
          message: `Successfully migrated ${normalizedFilePath}` 
        });
      } catch (r2Error) {
        console.error(`R2 upload error: ${r2Error instanceof Error ? r2Error.message : 'Unknown R2 error'}`);
        return NextResponse.json({ 
          success: false, 
          error: `Failed to upload to R2: ${r2Error instanceof Error ? r2Error.message : 'Unknown R2 error'}` 
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Error processing file migration:', error);
      
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Server error during migration:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'Server error processing your request' 
    }, { status: 500 });
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