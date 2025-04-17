'use server';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define return types for better type safety
type BaseConnectionResult = 
    | { success: false; error: string; client?: never }
    | { success: true; message: string; client: SupabaseClient };

type StorageConnectionResult = 
    | { success: false; error: string }
    | { success: true; message: string };

type TableConnectionResult = 
    | { success: false; error: string }
    | { success: true; message: string; rowCount: number | null };

/**
 * Base server action to validate Supabase credentials
 * Just checks if we can connect to Supabase with the provided credentials
 */
export async function connectToSupabase(
    supabaseUrl: string,
    supabaseKey: string
): Promise<BaseConnectionResult> {
    // Validate required fields
    if (!supabaseUrl || !supabaseKey) {
        return {
            success: false,
            error: 'Missing required credentials'
        };
    }
    
    try {
        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Test connection by getting service role status
        const { error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Error connecting to Supabase:', error);
            return {
                success: false,
                error: 'Could not connect to Supabase. Please check your credentials.'
            };
        }
        
        return {
            success: true,
            message: 'Successfully connected to Supabase',
            client: supabase
        };
    } catch (error) {
        console.error('Error connecting to Supabase:', error);
        
        return {
            success: false,
            error: 'Could not connect to Supabase. Please check your credentials.'
        };
    }
}

/**
 * Server action to validate Supabase credentials and bucket access
 */
export async function connectToSupabaseStorage(
    supabaseUrl: string,
    supabaseKey: string,
    bucketName: string
): Promise<StorageConnectionResult> {
    // First validate basic connection
    const baseConnection = await connectToSupabase(supabaseUrl, supabaseKey);
    if (!baseConnection.success) {
        return baseConnection;
    }
    
    // Validate bucket name
    if (!bucketName) {
        return {
            success: false,
            error: 'Bucket name is required'
        };
    }
    
    // Reuse the client from the base connection
    const supabase = baseConnection.client;
    
    try {
        // Test if bucket exists and is accessible
        const { error } = await supabase.storage.getBucket(bucketName);
        
        if (error) {
            console.error('Error validating Supabase bucket:', error);
            return {
                success: false,
                error: 'Bucket not found or not accessible. Please check your credentials and bucket name.'
            };
        }
        
        return {
            success: true,
            message: `Successfully connected to bucket: ${bucketName}`
        };
    } catch (error) {
        console.error('Error validating Supabase bucket:', error);
        
        return {
            success: false,
            error: 'Bucket not found or not accessible. Please check your credentials and bucket name.'
        };
    }
}

/**
 * Server action to validate Supabase credentials and table access
 * This checks if a table exists and has the expected structure for image URLs
 */
export async function connectToSupabaseTable(
    supabaseUrl: string,
    supabaseKey: string,
    tableName: string
): Promise<TableConnectionResult> {
    // First validate basic connection
    const baseConnection = await connectToSupabase(supabaseUrl, supabaseKey);
    if (!baseConnection.success) {
        return baseConnection;
    }
    
    // Validate table name
    if (!tableName) {
        return {
            success: false,
            error: 'Table name is required'
        };
    }
    
    // Reuse the client from the base connection
    const supabase = baseConnection.client;
    
    try {
        // Test if table exists by fetching a single row
        const { error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact' })
            .limit(1);
        
        if (error) {
            console.error('Error validating Supabase table:', error);
            
            // Provide more specific error messages for common error cases
            let errorMessage: string;
            
            // Type assertion for the PostgreSQL error structure
            interface PostgresError {
                code?: string;
                message?: string | Record<string, unknown>;
                details?: string;
                hint?: string;
            }
            
            const pgError = error as PostgresError;
            
            if (pgError.code === 'PGRST116') {
                // PostgreSQL error for relation not found
                errorMessage = `Table "${tableName}" doesn't exist. Please check the table name and ensure it exists in your database.`;
            } else if (pgError.code === '42501' || pgError.code === '42P01') {
                // Permission error or relation not found
                errorMessage = `Cannot access table "${tableName}". Either the table doesn't exist or you don't have sufficient permissions.`;
            } else if (pgError.code === 'PGRST301' || 
                      (typeof pgError.message === 'string' && pgError.message.includes('permission denied'))) {
                errorMessage = `Permission denied to access table "${tableName}". Make sure you're using a service role key with sufficient privileges.`;
            } else if (pgError.message && typeof pgError.message === 'object' && Object.keys(pgError.message).length === 0) {
                // Empty error object
                errorMessage = `Could not access table "${tableName}". The table may not exist or you lack permission to access it.`;
            } else {
                // Generic error message
                const msgString = typeof pgError.message === 'string' ? pgError.message : 'Unknown error';
                errorMessage = `Table "${tableName}" not accessible: ${msgString}`;
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
        
        return {
            success: true,
            message: `Successfully connected to table: ${tableName}`,
            rowCount: count
        };
    } catch (error) {
        console.error('Error validating Supabase table:', error);
        
        // Create a more informative error message for caught exceptions
        let errorMessage: string;
        
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('does not exist')) {
                errorMessage = `Table "${tableName}" doesn't exist. Please check the table name.`;
            } else if (error.message.includes('permission') || error.message.includes('access')) {
                errorMessage = `Permission denied to access table "${tableName}". Check your permissions and API key.`;
            } else {
                errorMessage = `Error accessing table "${tableName}": ${error.message}`;
            }
        } else {
            errorMessage = `Table "${tableName}" not found or not accessible. Please check your credentials and table name.`;
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
} 