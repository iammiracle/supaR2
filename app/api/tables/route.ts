import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { supabaseUrl, supabaseKey, bucketName } = await request.json();

    // Validate required parameters
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing required Supabase credentials' },
        { status: 400 }
      );
    }

    // Create a Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try multiple methods to get table information
    let tables = [];
    let errorMessage = '';
    
    // Method 1: Try RPC function
    try {
      const { data, error } = await supabase
        .rpc('get_tables')
        .select();
        
      if (!error && data && data.length > 0) {
        tables = data.map(t => (t.table_name || t.tablename));
        return NextResponse.json({ success: true, tables });
      } else if (error) {
        errorMessage += `RPC method failed: ${error.message}. `;
      }
    } catch (err) {
      errorMessage += `RPC call exception: ${err instanceof Error ? err.message : 'Unknown error'}. `;
    }
    
    // Method 2: Try information_schema
    try {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');
        
      if (!error && data && data.length > 0) {
        tables = data.map(item => item.table_name);
        return NextResponse.json({ success: true, tables });
      } else if (error) {
        errorMessage += `Information schema method failed: ${error.message}. `;
      }
    } catch (err) {
      errorMessage += `Information schema exception: ${err instanceof Error ? err.message : 'Unknown error'}. `;
    }
    
    // Method 3: Try direct SQL query
    try {
      const { data, error } = await supabase
        .from('_sqlj_tables') // Virtual table for SQL queries in some Supabase environments
        .select('*');
        
      if (!error && data && data.length > 0) {
        tables = data.map(item => item.name || item.table_name || item.tablename);
        return NextResponse.json({ success: true, tables });
      } else if (error) {
        errorMessage += `SQL method failed: ${error.message}. `;
      }
    } catch (err) {
      errorMessage += `SQL exception: ${err instanceof Error ? err.message : 'Unknown error'}. `;
    }
    
    // If all methods failed but tables were found, return them
    if (tables.length > 0) {
      return NextResponse.json({ success: true, tables });
    }
    
    // Default table list
    const defaultTables = ['images', 'profiles', 'users'];
    
    // If we have a bucketName, make sure it's included in the list
    if (bucketName && !defaultTables.includes(bucketName)) {
      defaultTables.unshift(bucketName);
    }
    
    // If all methods failed, return a hardcoded list with the bucket name
    return NextResponse.json({ 
      success: true, 
      tables: defaultTables,
      note: 'Using default tables list - actual database tables could not be retrieved',
      debug: errorMessage // Include the error messages for debugging
    });
    
  } catch (error) {
    console.error('Error in /api/tables:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 