'use server';

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

/**
 * Server action to validate R2 credentials and bucket access
 */
export async function connectToR2(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string
) {
    // Validate required fields
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        return {
            success: false,
            error: 'Missing required credentials'
        };
    }
    
    // Initialize R2 client
    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
    
    try {
        // Test if bucket exists and is accessible
        const command = new HeadBucketCommand({ Bucket: bucketName });
        await client.send(command);
        
        return {
            success: true,
            message: `Successfully connected to bucket: ${bucketName}`
        };
    } catch (error) {
        console.error('Error validating R2 bucket:', error);
        
        return {
            success: false,
            error: 'Bucket not found or not accessible. Please check your credentials and bucket name.'
        };
    }
} 