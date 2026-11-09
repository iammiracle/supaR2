# Security

SupaR2 is intended to run locally on a trusted machine.

Do not host a public SupaR2 instance that accepts other people's Supabase service role keys or Cloudflare R2 secrets. The app performs privileged migrations and should be treated as a local admin tool.

## Reporting Issues

If you find a security issue, please open a private report with the maintainer instead of filing a public issue with exploit details.

## Credential Guidance

- Prefer migration-specific Supabase and R2 credentials.
- Revoke credentials after a migration is complete.
- Do not commit `.env` files, service-role keys, or R2 secret access keys.
- Do not put secrets in `NEXT_PUBLIC_*` variables.
