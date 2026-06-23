# Writer's Vault Pro - Version 5

This version adds the requested professional features while still running as a simple local website.

## Added in Version 5

- User account UI
- Cloud sync scaffold
- Multiple series
- AI-powered character consistency checker
- AI timeline consistency checker
- AI chapter analyzer
- Export to TXT
- Export to Word-compatible .doc
- Export to PDF using browser print/save as PDF
- Improved manuscript editor
- Formatting buttons
- Chapter word counts
- Search active project
- Local fallback AI checklist mode

## Important

This is still a front-end website. It works immediately in local browser storage.

Cloud sync and live AI need external keys:

### Cloud Sync

This build includes a Settings screen for Supabase URL and anon key.

To make cloud sync fully live, create a Supabase project and add a table like:

Table: writer_vaults

Columns:
- id uuid primary key default gen_random_uuid()
- user_email text
- vault_data jsonb
- updated_at timestamp with time zone default now()

Then connect the `syncToCloud()` function inside `script.js` to Supabase's REST API or Supabase JS SDK.

### AI

Add an OpenAI API key in Settings.

The app calls:

https://api.openai.com/v1/responses

If no key is added, the AI tools still work in local checklist mode.

For a real public website, do not expose API keys in browser code. Use a backend/serverless function.

## How to use

1. Unzip this folder.
2. Open `index.html`.
3. Create a series.
4. Create a book.
5. Draft in Manuscript Editor.
6. Track bible items attached to either the book or whole series.
7. Export backup often.
