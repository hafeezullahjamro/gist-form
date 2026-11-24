# GIST Scholarship Program 2026 — Registration Portal

A responsive scholarship registration portal deployed on Netlify. Applicant
records and payment receipts are stored privately in **Netlify Blobs**
privately in **Netlify Blobs**.

## Included

- Campaign dashboard using the supplied desktop and mobile banners.
- Short two-step registration flow with shared browser/server validation.
- GIST assigns the test category from submitted education details.
- Students may change to any offered GIST course later.
- Scholarship and laptop-award messaging for all three test groups.
- Duplicate protection using student name and WhatsApp number.
- Private receipt storage with no public file URLs.
- Protected administrator dashboard with search, receipt viewing and
  Excel-compatible CSV export.

## Netlify architecture

- The netlify/database/migrations directory defines the PostgreSQL schema.
  Netlify applies pending migrations before publishing a production deploy.
- server/register.ts validates and writes applicant records to private Netlify Blobs.
- netlify/functions/register.ts stores each payment receipt in the private
  payment-receipts Blob store, then inserts the matching record.
- Admin routes verify a signed, HTTP-only session before returning applicant
  data, receipts or CSV exports.

Google Sheets, Google Cloud service accounts and service-account JSON keys are
not required.

## Environment variables

Set these in **Netlify → Project configuration → Environment variables**:

| Name | Value |
| --- | --- |
| VITE_EASYPAISA_ACCOUNT_TITLE | Public account title shown to candidates |
| VITE_EASYPAISA_ACCOUNT_NUMBER | Public Easypaisa number shown to candidates |
| ADMIN_USERNAME | Private dashboard username |
| ADMIN_PASSWORD | Private dashboard password |
| ADMIN_SESSION_SECRET | At least 32 random characters used to sign sessions |

The two VITE_ variables are intentionally public. Keep every ADMIN_ variable
private. Generate the session secret with: openssl rand -hex 32

## Deploy

1. Import hafeezullahjamro/gist-form into Netlify.
2. Netlify reads netlify.toml, installs dependencies, builds dist, bundles the
   Functions and applies the database migration.
3. Set the environment variables above.
4. Trigger a production deploy.
5. Open /api/register. A ready deployment returns JSON containing
   "ok": true and "Netlify storage is connected and ready."
6. Complete one test registration and verify it in the private dashboard.

## Administrator dashboard

Open: https://YOUR-SITE.netlify.app/#admin

The route is intentionally absent from public navigation. After signing in,
staff can:

- View total registrations, today's registrations and stored receipts.
- Search by name, phone, course or registration ID.
- Open a protected receipt in a new tab.
- Export all applicant rows as a UTF-8 CSV for Microsoft Excel.

Sessions expire after eight hours. The browser never receives the configured
password or session-signing secret.

## Stored registration fields

The database stores timestamp, registration ID, student name, WhatsApp,
father/guardian name, gender, city/district, education level, class or
semester, institution, GIST-assigned test category, preferred course and the
private payment-receipt Blob key.

The test category initially contains "Pending GIST assignment".

## Payment receipts

Receipts are stored in the private, site-wide Netlify Blob store named
payment-receipts, using keys such as
receipts/GIST-2026-XXXXXXXXXX.jpg. The database stores only the matching
private blob key. Receipt uploads accept JPG, PNG, WebP or PDF files up to
2 MB.

## Local development

Run:

    npm install
    npm run netlify:dev

Netlify Blobs local development requires a recent Netlify CLI. A bare
npm run dev previews only the browser interface and does not serve the
Functions or database.

## Security notes

- Applicant and receipt endpoints require a valid signed admin session.
- The admin login route is rate-limited in netlify.toml.
- Applicant records and receipts stay in private Netlify Blobs stores.
- A unique database constraint prevents simultaneous duplicate submissions.
- Receipt files are revalidated on the server and never receive public URLs.
- Real passwords and secrets must never be committed to GitHub.

## Editing with Codex

See CODEX_PROMPT.md for the established fields and product requirements.
