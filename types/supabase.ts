import { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bucketName: string;
  isConnected?: boolean;
}

export interface TableColumnInfo {
  name: string;
  type: string;
  is_nullable: boolean;
}

export interface SupabaseConnectionResult {
  success: boolean;
  error?: string;
  client?: SupabaseClient;
} 