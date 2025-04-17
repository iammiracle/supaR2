'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConnectionStore } from "@/lib/connection-store";

export default function SupabaseConnection() {
  const {
    supabaseConfig,
    supabaseConnected,
    migrationMode,
    tempMigrationMode,
    availableBuckets,
    editingSupabaseConfig,
    openSupabaseDialog,
    isClientSide,
    
    setEditingSupabaseConfig,
    setTempMigrationMode,
    toggleSupabaseDialog,
    resetSupabaseConfig,
    connectToSupabase
  } = useConnectionStore();

  return (
    <div className="px-4 py-5 sm:p-6 border-b md:border-b-0 md:border-r border-gray-200">
      <h2 className="text-base font-bold text-gray-900">Supabase Connection</h2>
      <p className="mt-2 text-sm font-medium text-gray-500">
        Connect to your Supabase storage bucket to migrate files from.
      </p>
      
      <div className="mt-4">
        {isClientSide && supabaseConnected ? (
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <div><strong>URL:</strong> {supabaseConfig.supabaseUrl}</div>
                <div className="mt-2">
                  <strong>{migrationMode === 'file' ? 'Bucket' : 'Table'}:</strong> {supabaseConfig.bucketName}
                </div>
                <div className="mt-2">
                  <strong>Mode:</strong> {migrationMode === 'file' ? 'Storage' : 'Table'}
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
          <Dialog 
            open={openSupabaseDialog} 
            onOpenChange={(open) => toggleSupabaseDialog(open)}
          >
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {supabaseConnected ? "Edit Connection" : "Connect to Supabase"}
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
                    value={editingSupabaseConfig.supabaseUrl}
                    onChange={(e) => setEditingSupabaseConfig({ supabaseUrl: e.target.value })}
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
                    value={editingSupabaseConfig.supabaseKey}
                    onChange={(e) => setEditingSupabaseConfig({ supabaseKey: e.target.value })}
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
                
                {availableBuckets.length > 0 ? (
                  <div>
                    <label htmlFor="bucketSelector" className="block text-sm font-medium text-gray-700">
                      {tempMigrationMode === 'file' ? 'Select Bucket' : 'Select Table'}
                    </label>
                    <select
                      id="bucketSelector"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={editingSupabaseConfig.bucketName || ''}
                      onChange={(e) => setEditingSupabaseConfig({ bucketName: e.target.value })}
                    >
                      <option value="" disabled>
                        {tempMigrationMode === 'file' ? 'Select a bucket' : 'Select a table'}
                      </option>
                      {availableBuckets.map(bucketName => (
                        <option key={bucketName} value={bucketName}>
                          {bucketName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : editingSupabaseConfig.supabaseUrl && editingSupabaseConfig.supabaseKey ? (
                  <div>
                    <label htmlFor="bucketName" className="block text-sm font-medium text-gray-700">
                      {tempMigrationMode === 'file' ? 'Bucket Name' : 'Table Name'}
                    </label>
                    <input
                      type="text"
                      id="bucketName"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={editingSupabaseConfig.bucketName || ''}
                      onChange={(e) => setEditingSupabaseConfig({ bucketName: e.target.value })}
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
                    onClick={connectToSupabase}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {supabaseConnected ? "Update Connection" : "Connect"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {supabaseConnected && (
            <button
              type="button"
              onClick={resetSupabaseConfig}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 