'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConnectionStore } from "@/lib/connection-store";
import { Database, Plug, Unplug } from "lucide-react";

export default function SupabaseConnection() {
  const {
    supabaseConnected,
    tempMigrationMode,
    editingSupabaseConfig,
    openSupabaseDialog,
    
    setEditingSupabaseConfig,
    setTempMigrationMode,
    toggleSupabaseDialog,
    resetSupabaseConfig,
    connectToSupabase
  } = useConnectionStore();

  return (
          <Dialog 
            open={openSupabaseDialog} 
            onOpenChange={(open) => toggleSupabaseDialog(open)}
          >
            <DialogTrigger asChild>
              <button
                type="button"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xs text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                aria-label={supabaseConnected ? "Edit Supabase settings" : "Connect Supabase source"}
                title={supabaseConnected ? "Supabase connected" : "Connect Supabase"}
              >
                <Database className="h-4 w-4" aria-hidden="true" />
                <span
                  className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-xs ${supabaseConnected ? "bg-emerald-400" : "bg-neutral-600"}`}
                  aria-hidden="true"
                />
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    Migration Mode
                  </label>
                  <select
                    id="imageSourceSelect"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={tempMigrationMode}
                    onChange={(e) => setTempMigrationMode(e.target.value as "file" | "table")}
                  >
                    <option value="file">Storage</option>
                    <option value="table">Table</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Use table mode when you also need database URL rewrites.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="bucketName" className="block text-sm font-medium text-gray-700">
                    Storage Bucket Name
                  </label>
                  <input
                    type="text"
                    id="bucketName"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingSupabaseConfig.bucketName || ''}
                    onChange={(e) => setEditingSupabaseConfig({ bucketName: e.target.value })}
                    placeholder="avatars"
                  />
                </div>

                {tempMigrationMode === 'table' && (
                  <>
                    <div>
                      <label htmlFor="tableName" className="block text-sm font-medium text-gray-700">
                        Table Name
                      </label>
                      <input
                        type="text"
                        id="tableName"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={editingSupabaseConfig.tableName || ''}
                        onChange={(e) => setEditingSupabaseConfig({ tableName: e.target.value })}
                        placeholder="profiles"
                      />
                    </div>

                    <div>
                      <label htmlFor="primaryKeyColumn" className="block text-sm font-medium text-gray-700">
                        Primary Key Column
                      </label>
                      <input
                        type="text"
                        id="primaryKeyColumn"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={editingSupabaseConfig.primaryKeyColumn || 'id'}
                        onChange={(e) => setEditingSupabaseConfig({ primaryKeyColumn: e.target.value })}
                        placeholder="id"
                      />
                    </div>
                  </>
                )}
                
                <div className="pt-4 flex items-center justify-between gap-3">
                  {supabaseConnected ? (
                    <button
                      type="button"
                      onClick={resetSupabaseConfig}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xs shadow-sm text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Unplug className="mr-2 h-4 w-4" aria-hidden="true" />
                      Disconnect
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={connectToSupabase}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xs shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Plug className="mr-2 h-4 w-4" aria-hidden="true" />
                    {supabaseConnected ? "Update Connection" : "Connect"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
  );
} 
