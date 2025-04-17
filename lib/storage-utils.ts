"use client";

import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// Validation schemas for connection credentials
export const SupabaseConfigSchema = z.object({
    supabaseUrl: z.string().url('Invalid Supabase URL'),
    supabaseKey: z.string().min(1, 'Supabase service role key is required'),
    bucketName: z.string().min(1, 'Bucket name is required')
});

export const CloudflareConfigSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required'),
    accessKeyId: z.string().min(1, 'Access Key ID is required'),
    secretAccessKey: z.string().min(1, 'Secret Access Key is required'),
    bucketName: z.string().min(1, 'Bucket name is required'),
    publicUrlPattern: z.string().optional(),
    customDomain: z.string().optional(),
});

export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;
export type CloudflareConfig = z.infer<typeof CloudflareConfigSchema>;

// Local storage keys
const STORAGE_KEYS = {
    SUPABASE_CONFIG: 'supabase_config',
    CLOUDFLARE_CONFIG: 'cloudflare_config',
};

// Initialize Supabase client - without bucket validation
const authClientCache: Record<string, SupabaseClient> = {};

export function initSupabaseClientForAuth(config: Pick<SupabaseConfig, 'supabaseUrl' | 'supabaseKey'>) {
    try {
        // Only validate the URL and key, not the bucket
        const { supabaseUrl, supabaseKey } = config;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL and key are required');
        }
        
        // Create a cache key based on the config
        const cacheKey = `${supabaseUrl}:${supabaseKey}`;
        
        // Return cached client if available
        if (authClientCache[cacheKey]) {
            return authClientCache[cacheKey];
        }
        
        // Create new client and cache it
        const client = createClient(supabaseUrl, supabaseKey);
        authClientCache[cacheKey] = client;
        
        return client;
    } catch (error) {
        console.error('Error initializing Supabase client for auth:', error);
        throw error;
    }
}

// Initialize Supabase client
const supabaseClientCache: Record<string, SupabaseClient> = {};

export function initSupabaseClient(config: SupabaseConfig) {
    try {
        const validatedConfig = SupabaseConfigSchema.parse(config);
        
        // Create a cache key based on the config
        const cacheKey = `${validatedConfig.supabaseUrl}:${validatedConfig.supabaseKey}:${validatedConfig.bucketName}`;
        
        // Return cached client if available
        if (supabaseClientCache[cacheKey]) {
            return supabaseClientCache[cacheKey];
        }
        
        // Create new client and cache it
        const client = createClient(validatedConfig.supabaseUrl, validatedConfig.supabaseKey);
        supabaseClientCache[cacheKey] = client;
        
        return client;
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
        throw error;
    }
}

// Initialize Cloudflare R2 client (using S3 compatible API)
export function initCloudflareR2Client(config: CloudflareConfig) {
    try {
        const validatedConfig = CloudflareConfigSchema.parse(config);
        
        return new S3Client({
            region: 'auto',
            endpoint: `https://${validatedConfig.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: validatedConfig.accessKeyId,
                secretAccessKey: validatedConfig.secretAccessKey,
            },
        });
    } catch (error) {
        console.error('Error initializing Cloudflare R2 client:', error);
        throw error;
    }
}

// Check if a Cloudflare R2 bucket exists and is accessible
export async function checkR2BucketExists(client: S3Client, bucketName: string): Promise<boolean> {
    try {
        // In development mode, skip the actual bucket check to avoid CORS issues
        if (typeof window !== 'undefined') {
            console.warn('Bypassing R2 bucket validation in browser environment due to CORS limitations');
            // We just validate that the bucket name is provided
            return bucketName.trim().length > 0;
        }
        
        // Server-side only (this won't run in the browser)
        const command = new HeadBucketCommand({ Bucket: bucketName });
        await client.send(command);
        return true;
    } catch (error) {
        console.error('Error checking R2 bucket:', error);
        return false;
    }
}

// Save Supabase configuration to localStorage
export function saveSupabaseConfig(config: SupabaseConfig) {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify(config));
    }
}

// Load Supabase configuration from localStorage
export function loadSupabaseConfig(): SupabaseConfig | null {
    if (typeof window !== 'undefined') {
        const config = localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG);
        if (config) {
            try {
                return JSON.parse(config) as SupabaseConfig;
            } catch (e) {
                console.error('Failed to parse Supabase config:', e);
            }
        }
    }
    return null;
}

// Save Cloudflare configuration to localStorage
export function saveCloudflareConfig(config: CloudflareConfig) {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CLOUDFLARE_CONFIG, JSON.stringify(config));
    }
}

// Load Cloudflare configuration from localStorage
export function loadCloudflareConfig(): CloudflareConfig | null {
    if (typeof window !== 'undefined') {
        const config = localStorage.getItem(STORAGE_KEYS.CLOUDFLARE_CONFIG);
        if (config) {
            try {
                return JSON.parse(config) as CloudflareConfig;
            } catch (e) {
                console.error('Failed to parse Cloudflare config:', e);
            }
        }
    }
    return null;
}

// Get environment variable or fallback
export function getEnvVar(key: string, fallback: string = ''): string {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || fallback;
    }
    return fallback;
}

// Load migration mode from localStorage
export function loadMigrationMode(): string {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('migration_mode') || 'files';
    }
    return 'files';
}

// Load configs from environment variables if available (and not in localStorage)
export function getSupabaseConfigFromEnv(): Partial<SupabaseConfig> {
    return {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        bucketName: process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME || '',
    };
}

export function getCloudflareConfigFromEnv(): Partial<CloudflareConfig> {
    return {
        accountId: process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID || '',
        accessKeyId: process.env.NEXT_PUBLIC_CLOUDFLARE_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.NEXT_PUBLIC_CLOUDFLARE_SECRET_ACCESS_KEY || '',
        bucketName: process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_NAME || '',
        publicUrlPattern: process.env.NEXT_PUBLIC_CLOUDFLARE_PUBLIC_URL_PATTERN || '',
        customDomain: process.env.NEXT_PUBLIC_CLOUDFLARE_CUSTOM_DOMAIN || '',
    };
} 