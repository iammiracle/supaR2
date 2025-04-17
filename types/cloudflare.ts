export interface CloudflareConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlPattern?: string;
  customDomain?: string;
  isConnected?: boolean;
}

export interface CloudflareConnectionResult {
  success: boolean;
  error?: string;
} 