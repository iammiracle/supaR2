'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConnectionStore } from "@/lib/connection-store";

export default function CloudflareConnection() {
  const {
    cloudflareConfig,
    cloudflareConnected,
    editingCloudflareConfig,
    openCloudflareDialog,
    isClientSide,
    
    setEditingCloudflareConfig,
    toggleCloudflareDialog,
    resetCloudflareConfig,
    connectToCloudflare
  } = useConnectionStore();

  return (
    <div className="px-4 py-5 sm:p-6">
      <h2 className="text-base font-bold text-gray-900">Cloudflare R2 Connection</h2>
      <p className="mt-2 text-sm font-medium text-gray-500">
        Connect to your Cloudflare R2 bucket to migrate files to.
      </p>
      
      <div className="mt-4">
        {isClientSide && cloudflareConnected ? (
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <div><strong>Account ID:</strong> {cloudflareConfig.accountId}</div>
                <div className="mt-2"><strong>Bucket:</strong> {cloudflareConfig.bucketName}</div>
                <div className="mt-2"><strong>Custom Domain:</strong> {cloudflareConfig.customDomain}</div>
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
                Not connected to Cloudflare R2
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Not Connected
              </span>
            </div>
          </div>
        )}
        
        <div className="flex space-x-2">
          <Dialog 
            open={openCloudflareDialog} 
            onOpenChange={(open) => toggleCloudflareDialog(open)}
          >
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {cloudflareConnected ? "Edit Connection" : "Connect to Cloudflare R2"}
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={editingCloudflareConfig.bucketName}
                    onChange={(e) => setEditingCloudflareConfig({ bucketName: e.target.value })}
                    placeholder="your-r2-bucket-name"
                  />
                </div>

                <div>
                  <label htmlFor="customDomain" className="block text-sm font-medium text-gray-700">
                    Custom Domain (Optional)
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 py-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                      https://
                    </span>
                    <input
                      type="text"
                      id="customDomain"
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={editingCloudflareConfig.customDomain || ''}
                      onChange={(e) => setEditingCloudflareConfig({ customDomain: e.target.value })}
                      placeholder="comechop"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Enter your domain name without https:// prefix</p>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={connectToCloudflare}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {cloudflareConnected ? "Update Connection" : "Connect"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {cloudflareConnected && (
            <button
              type="button"
              onClick={resetCloudflareConfig}
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