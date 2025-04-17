import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, accessKeyId, secretAccessKey, bucketName } = body;
    
    // Validate required fields
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json(
        { success: false, error: 'Missing required credentials' }, 
        { status: 400 }
      );
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
      
      return NextResponse.json({ 
        success: true, 
        message: `Successfully connected to bucket: ${bucketName}` 
      });
    } catch (error) {
      console.error('Error validating R2 bucket:', error);
      
      return NextResponse.json({ 
        success: false, 
        error: 'Bucket not found or not accessible. Please check your credentials and bucket name.' 
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Server error validating R2 bucket:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'Server error processing your request' 
    }, { status: 500 });
  }
} 