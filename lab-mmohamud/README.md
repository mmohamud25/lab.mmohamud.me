# lab.mmohamud.me

Hands-on security labs, built as a static site from the `labs` table in Supabase and deployed to GitHub Pages.

- **Write labs** in the admin: admin.mmohamud.me → Labs. Publishing rebuilds this site automatically (about a minute).
- **Rebuilds** also run on every push to `main`, once a day, and on demand (Actions → Build and deploy labs → Run workflow).
- **Build locally:** `npm install` then `SUPABASE_ANON_KEY=… node scripts/build.mjs` → output in `_site/`.

## Writing conventions (in a lab's write-up)
- `## Heading` → a section in the "On this page" menu
- A code block marked `bash`, `spl`, `powershell`, `python`… → a labelled terminal panel with a Copy button
- A code block marked `output` → an "Expected output" panel
- `> text` → a note box
- `![Alt](link "Caption")` on its own line → a figure with a caption

## Notes
- `src/site.js` is a copy of the admin's `t.js` (banner, maintenance mode, privacy-friendly analytics, goals). Keep them in sync.
- Fonts are self-hosted (`src/fonts/`); no requests go to Google.
