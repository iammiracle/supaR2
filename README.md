# SupaR2 Migration Tool

A powerful migration utility for transferring files and image URLs from Supabase Storage to Cloudflare R2.

## Overview

SupaR2 simplifies the migration process between Supabase Storage and Cloudflare R2, offering two migration modes:

- **File Mode**: Directly migrate files from Supabase Storage buckets to Cloudflare R2
- **Table Mode**: Update image URLs in database tables while migrating the actual images to Cloudflare R2

## Features

- **Dual Migration Support**: Choose between file-based or table-based migration
- **Custom Domain Support**: Use your own domain for Cloudflare R2 URLs
- **Batch Processing**: Select multiple files or rows to migrate in batches
- **Progress Tracking**: Monitor migration status with detailed progress information
- **URL Filtering**: Filter table rows by URL patterns to find specific assets
- **Error Handling**: Comprehensive error reporting for failed migrations
- **Responsive UI**: Modern interface that works across devices
- **Well-Organized Code**: Clean architecture with consistent 4-space indentation and modular stores

## Getting Started

### Prerequisites

- Supabase project with Storage enabled
- Cloudflare R2 bucket 
- Node.js 18+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/supar2.git
cd supar2

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to access the application.

## Configuration

### Supabase Configuration

1. **URL**: Your Supabase project URL
2. **Service Role Key**: A service role API key with access to Storage and Database
3. **Bucket/Table Name**: The name of your Storage bucket or Database table

### Cloudflare R2 Configuration

1. **Account ID**: Your Cloudflare account ID
2. **Access Key ID**: R2 access key
3. **Secret Access Key**: R2 secret key
4. **Bucket Name**: R2 bucket name
5. **Custom Domain** (Optional): Your custom domain for R2 URLs

## Usage

### File Mode Migration

1. Connect to both Supabase and Cloudflare R2
2. Browse your Supabase Storage bucket
3. Select files to migrate
4. Click "Start Migration"
5. Monitor progress in the Migration Overview panel

### Table Mode Migration

1. Connect to both Supabase and Cloudflare R2
2. Select the database table containing image URLs
3. Choose the column containing image URLs
4. Optionally use the File Path Pattern field to filter URLs (e.g., "supabase.co" or "storage/v1/")
5. Select the rows to migrate
6. Click "Migrate Selected Rows"
7. The application will extract the file paths from URLs, migrate the files, and update the table with new R2 URLs

## Troubleshooting

### Connection Issues

- Verify your API keys and credentials
- Ensure your Supabase service role has sufficient permissions
- Check that your Cloudflare R2 bucket exists and is accessible

### Migration Errors

- Review the Error Details section for specific error messages
- Ensure the image URLs in your tables are correctly formatted
- Verify that the source files exist in Supabase Storage

## Architecture

The application is built with a modern React architecture:

- **Server Actions**: Next.js server actions for secure, type-safe API calls
- **Connection Store**: Centralized state management using Zustand with persistence
- **Component Isolation**: Each component maintains its own state using React hooks
- **Hydration Management**: Careful handling of client/server state to prevent hydration mismatches

## License

MIT

## Acknowledgements

- [Next.js](https://nextjs.org) - The React framework used
- [Supabase](https://supabase.com) - Open Source Firebase Alternative
- [Cloudflare R2](https://developers.cloudflare.com/r2/) - S3-compatible object storage
