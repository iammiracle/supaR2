# SupaR2

SupaR2 is a local migration utility for moving assets from Supabase Storage to Cloudflare R2. It has two modes:

- **File migration** copies selected objects from a Supabase Storage bucket into an R2 bucket.
- **Table URL migration** copies objects and rewrites URLs in a Supabase database table.

The app does not require accounts, login, or a hosted backend. Run it locally, enter credentials for the current session, migrate, then close it.

## Safety Model

SupaR2 asks for high-privilege credentials, so treat it like a local admin tool.

- Credentials are kept in runtime memory and are cleared on refresh.
- Credentials are not saved to `localStorage`.
- Do not deploy this app publicly with real credentials.
- Use short-lived or migration-specific credentials when possible.
- Review table migrations with a small batch before updating many rows.

## Requirements

- Node.js 20.9 or newer
- A Supabase project with Storage enabled
- A Cloudflare R2 bucket
- R2 API credentials with access to the target bucket

## Getting Started

```bash
git clone https://github.com/yourusername/supar2.git
cd supar2
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Credentials

Use your Supabase project URL and a service role key with permission to read Storage and update the target table when using table mode.

For file migration, provide:

- Supabase URL
- Service role key
- Source Storage bucket name

For table URL migration, provide:

- Supabase URL
- Service role key
- Source Storage bucket name
- Table name
- Primary key column, usually `id`

## Cloudflare R2 Credentials

Provide:

- Cloudflare account ID
- R2 access key ID
- R2 secret access key
- Destination R2 bucket name

For table URL migration, also provide a public URL pattern such as:

```text
https://assets.example.com/{path}
```

SupaR2 replaces `{path}` with the copied object key. You can also provide a public domain fallback such as `https://assets.example.com`.

## Current Limits

- Table previews load the first 100 rows.
- Table mode updates one selected row at a time.
- Object keys are preserved when copied to R2.
- The tool does not delete Supabase objects after migration.
- The tool does not configure R2 public access for you.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## License

MIT
