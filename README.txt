# Writer's Vault Cloud - Version 6

This version removes AI and adds Supabase account/cloud sync wiring.

## Included

- Supabase project URL and anon/public key already added
- Sign up
- Sign in
- Sign out
- Password reset
- Manual cloud sync
- Load cloud save
- Multiple series
- Book-first project structure
- Manuscript editor
- Chapter planner
- Characters
- Plot threads
- Timeline
- Worldbuilding
- Relationships
- Export TXT
- Export Word-compatible DOC
- Export PDF through browser print
- Export Series Bible DOC
- JSON backup/restore

## Supabase project used

Project URL:
https://eygiasbppwcijzvfoxwp.supabase.co

Anon/Public Key:
sb_publishable_-iKq8JUH2VBrG2u3WCpGxg_Uq5Fq845

## Required Supabase table

In Supabase, open SQL Editor and run this:

```sql
create table if not exists public.writer_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_email text,
  vault_data jsonb not null,
  updated_at timestamp with time zone default now()
);

alter table public.writer_vaults enable row level security;

create policy "Users can read their own vault"
on public.writer_vaults
for select
using (auth.uid() = user_id);

create policy "Users can insert their own vault"
on public.writer_vaults
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own vault"
on public.writer_vaults
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## How to use

1. Unzip this folder.
2. Open `index.html`.
3. Click Account.
4. Sign up or sign in.
5. Create your series/book.
6. Use Sync Now to save to cloud.
7. Use Load Cloud on another device after signing in.

## Notes

This is a browser-based version. It uses localStorage plus Supabase cloud sync.
The anon/public key is safe to use in frontend apps, but never add a Supabase service role key to frontend code.
