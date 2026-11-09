'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConnectionStore } from "@/lib/connection-store";
import { Cloud, Plug, Unplug } from "lucide-react";

export default function CloudflareConnection() {
  const {
    cloudflareConnected,
    editingCloudflareConfig,
    openCloudflareDialog,
    
    setEditingCloudflareConfig,
    toggleCloudflareDialog,
    resetCloudflareConfig,
    connectToCloudflare
  } = useConnectionStore();

  return (
          <Dialog 
            open={openCloudflareDialog} 
            onOpenChange={(open) => toggleCloudflareDialog(open)}
          >
            <DialogTrigger asChild>
              <button
                type="button"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xs text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                aria-label={cloudflareConnected ? "Edit Cloudflare R2 settings" : "Connect Cloudflare R2 destination"}
                title={cloudflareConnected ? "Cloudflare R2 connected" : "Connect Cloudflare R2"}
              >
                <Cloud className="h-4 w-4" aria-hidden="true" />
                <span
                  className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-xs ${cloudflareConnected ? "bg-orange-400" : "bg-neutral-600"}`}
                  aria-hidden="true"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Cloudflare R2 Connection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label htmlFor="accountId" className="block text-sm font-medium text-gray-700">
                    Account ID
                  </label>
                  <input
                    type="text"
                    id="accountId"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingCloudflareConfig.accountId}
                    onChange={(e) => setEditingCloudflareConfig({ accountId: e.target.value })}
                    placeholder="your-account-id"
                  />
                </div>
                
                <div>
                  <label htmlFor="accessKeyId" className="block text-sm font-medium text-gray-700">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    id="accessKeyId"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingCloudflareConfig.accessKeyId}
                    onChange={(e) => setEditingCloudflareConfig({ accessKeyId: e.target.value })}
                    placeholder="your-access-key-id"
                  />
                </div>
                
                <div>
                  <label htmlFor="secretAccessKey" className="block text-sm font-medium text-gray-700">
                    Secret Access Key
                  </label>
                  <input
                    type="password"
                    id="secretAccessKey"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingCloudflareConfig.secretAccessKey}
                    onChange={(e) => setEditingCloudflareConfig({ secretAccessKey: e.target.value })}
                    placeholder="your-secret-access-key"
                  />
                </div>
                
                <div>
                  <label htmlFor="r2BucketName" className="block text-sm font-medium text-gray-700">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    id="r2BucketName"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingCloudflareConfig.bucketName}
                    onChange={(e) => setEditingCloudflareConfig({ bucketName: e.target.value })}
                    placeholder="your-r2-bucket-name"
                  />
                </div>

                <div>
                  <label htmlFor="publicUrlPattern" className="block text-sm font-medium text-gray-700">
                    Public URL Pattern (Optional)
                  </label>
                  <input
                    type="text"
                    id="publicUrlPattern"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingCloudflareConfig.publicUrlPattern || ''}
                    onChange={(e) => setEditingCloudflareConfig({ publicUrlPattern: e.target.value })}
                    placeholder="https://assets.example.com/{path}"
                  />
                  <p className="mt-1 text-xs text-gray-500">Required for table URL rewrites. Use {'{path}'} where the object key should go.</p>
                </div>

                <div>
                  <label htmlFor="customDomain" className="block text-sm font-medium text-gray-700">
                    Public Domain Fallback (Optional)
                  </label>
                  <input
                    type="text"
                    id="customDomain"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-xs shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingCloudflareConfig.customDomain || ''}
                    onChange={(e) => setEditingCloudflareConfig({ customDomain: e.target.value })}
                    placeholder="https://assets.example.com"
                  />
                </div>
                
                <div className="pt-4 flex items-center justify-between gap-3">
                  {cloudflareConnected ? (
                    <button
                      type="button"
                      onClick={resetCloudflareConfig}
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
                    onClick={connectToCloudflare}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xs shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Plug className="mr-2 h-4 w-4" aria-hidden="true" />
                    {cloudflareConnected ? "Update Connection" : "Connect"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
  );
} 
