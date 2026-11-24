# GIST Scholarship Program 2026 — Registration Portal

A deployment-ready responsive scholarship portal for **Netlify**. Registrations are written to **Google Sheets**, while payment receipts are stored privately in **Netlify Blobs**.

## Included

- A campaign dashboard using the supplied desktop and mobile banners, with a direct registration call to action.
- A short registration flow covering student details, education, preferred course, and payment receipt.
- Students do not choose a test category. GIST assigns one later from the submitted qualification details.
- Three program groups are explained to students: **Elementary**, **Secondary & Higher Secondary**, and **Undergraduate**.
- Clear messaging that scholarships are awarded to test toppers, the top performer in each category receives a laptop, and students may change to any offered course later.
- Educational level-dependent class/semester selection.
- Mobile-friendly design, field validation, step-by-step wizard, submission confirmation and unique registration ID.
- Duplicate warning when **the same full name and mobile number** have already been submitted.
- Google Sheets authentication happens **only on the server**. No private Google credentials are bundled into the browser.
- Responsive banner placement: alongside the form on desktop and above the form on mobile.
- A private administrator dashboard with signed, HTTP-only login sessions, applicant search, protected receipt viewing and Excel-compatible CSV export.

## 1. Review the offered courses

Edit `GIST_COURSES` in `shared/options.ts` before launch if the official course list changes. The UI and backend use this shared list, so unsupported submissions are rejected.

## 2. Create the Google Sheet

1. In Google Sheets, create a spreadsheet called **GIST Scholarship Registrations 2026**.
2. Rename its first worksheet/tab exactly **Registrations**. The backend auto-creates its header row on the first successful submission to a completely empty tab. **Do not manually reorder columns.**
   If you tested an older version of this project, use a new empty tab because the form now has a new 13-column layout.
3. Copy its spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`. The app also accepts the full Sheet URL if you paste that into `GOOGLE_SHEET_ID` by mistake.
4. In Google Cloud Console, create or choose a Google Cloud project.
5. Enable the **Google Sheets API** on that project.
6. Create a **service account** (IAM & Admin → Service Accounts). Create/download a **JSON key** for that account, if your organization's security policy permits service account keys.
7. Share the **Google Sheet** with the service account's `client_email` as an **Editor**. This is essential: API access doesn't automatically grant spreadsheet access.

**Do not upload the JSON file or put it in `public/`, `src/`, or GitHub.**

## 3. Attach the Google Sheet to the form

Set these environment variables in Netlify:

| Name | Value |
| --- | --- |
| `GOOGLE_SHEET_ID` | Spreadsheet ID from step 2 |
| `GOOGLE_SHEET_TAB` | `Registrations` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` in your service account JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` from your service account JSON, retaining the header/footer and line breaks |
| `VITE_EASYPAISA_ACCOUNT_TITLE` | Public account title shown to candidates |
| `VITE_EASYPAISA_ACCOUNT_NUMBER` | Public Easypaisa number shown to candidates |
| `ADMIN_USERNAME` | Private dashboard username |
| `ADMIN_PASSWORD` | Private dashboard password; store only in Netlify |
| `ADMIN_SESSION_SECRET` | At least 32 random characters used to sign login sessions |

If the dashboard won't accept multiline values, paste the key with `\n` in place of line breaks. The server supports both formats.

As an alternative to the email and private-key variables, set one private variable named `GOOGLE_SERVICE_ACCOUNT_JSON` to the complete contents of the downloaded JSON file. Do not set both methods unless the values belong to the same service account.

Keep all `GOOGLE_` values private. The two `VITE_EASYPAISA_` values are intentionally public because candidates must see them in the form.

Keep all `ADMIN_` values private. Generate the session secret locally with `openssl rand -hex 32`. Never put the real password or session secret in GitHub, source code, or any `VITE_` variable.

## 4. Deploy and verify on Netlify

1. Import the same GitHub repo into [Netlify](https://netlify.com).
2. Netlify will read `netlify.toml`: build command `npm run build`, publish folder `dist`, functions folder `netlify/functions`.
3. Add the environment variables from step 3. The `GOOGLE_` and `ADMIN_` values must be available to Functions; the `VITE_` values must be available during the build.
4. Trigger a fresh deploy after saving the variables. `VITE_` values are inserted at build time, so changing them without redeploying will not update the form.
5. Open `https://YOUR-SITE.netlify.app/api/register` in a browser. A correct connection returns JSON containing `"ok": true` and `"Google Sheets is connected"`. The endpoint does not expose any credential.
6. Complete one test registration.
7. Verify the new row in Google Sheets and the receipt in **Data & Storage → Blobs → payment-receipts → receipts** in Netlify.

`netlify.toml` routes `/api/register` to Netlify Functions automatically.

## 5. Use the private dashboard

1. After deploying and configuring the three `ADMIN_` variables, visit `https://YOUR-SITE.netlify.app/#admin`.
2. Sign in with the configured username and password. There is intentionally no public dashboard link.
3. Search registrations, select **View receipt**, or choose **Export for Excel**. The export is a UTF-8 CSV that opens correctly in Microsoft Excel.
4. Choose **Sign out** when finished. Sessions expire automatically after eight hours.

The browser never receives the configured password or session-signing secret. Google Sheet data, receipt downloads and CSV exports all verify the signed HTTP-only session on the server before returning anything. Netlify also limits the admin session route to 10 requests per minute per IP and domain to reduce password-guessing attempts.

## 6. Test locally

```bash
npm install
npm run netlify:dev
```

Create a **local `.env` file** (from `.env.example`) and insert your own credentials. Use the URL printed by the Netlify development server (not bare Vite) to test full Google Sheets submission. `npm run dev` alone previews only the frontend and does **not** serve `/api/register`.

If the site is served with a static HTTP server, the interface can be reviewed but registration, receipt storage and admin login cannot work because Netlify Functions are not running. The form now displays a clear local-preview message instead of a JSON parsing error in that situation.

## Sheet columns

The automatically created columns are:

`Timestamp (UTC)`, `Registration ID`, `Student Full Name`, `Student WhatsApp`, `Father / Guardian Name`, `Gender`, `City / District`, `Current Education Level`, `Class / Year / Semester`, `School / College / University`, `Test Category (Assigned by GIST)`, `Preferred GIST Course`, `Payment Receipt Blob Key`.

The category column is initially saved as `Pending GIST assignment` so staff can assign it after reviewing the student's qualification.

## Where payment receipts are stored

The implemented and recommended setup stores payment receipts in the private, site-wide Netlify Blob store named `payment-receipts`. The Sheet stores the matching blob key, such as `receipts/GIST-2026-....jpg`. Authorized staff can open **Netlify → Data & Storage → Blobs → payment-receipts → receipts** and download the file with the same registration ID.

Google Drive can also store the files, but it is not used in this build. A secure Drive implementation needs the Google Drive API plus a Shared Drive or a correctly shared destination folder; it also introduces separate file permissions and link-management work. Keeping files in Netlify Blobs avoids public receipt links and keeps the Google service account limited to Sheets access.

## Google Sheet connection troubleshooting

Visit `/api/register` on the deployed site after every credential change. The connection check reports the most common setup problem without revealing secrets:

- **Missing environment variable:** add the named variable in Netlify, then redeploy.
- **Google authentication failed:** copy `client_email` and `private_key` again from the same JSON key.
- **Google denied access:** enable the Google Sheets API and share the Sheet with the service-account email as Editor.
- **Sheet not found:** correct `GOOGLE_SHEET_ID` and confirm sharing.
- **Worksheet tab not found:** rename the worksheet tab to `Registrations`, or make `GOOGLE_SHEET_TAB` exactly match it.
- **Older header layout:** create a new empty `Registrations` tab. A header-only test tab is repaired automatically; existing registration data is never overwritten.

## Important notes for GIST

- There is **no live Google Sheets connection** until your own service account and sheet variables are configured.
- Receipt uploads accept JPG, PNG, WebP, or PDF files up to 2 MB. They are kept private in the `payment-receipts` Netlify Blob store.
- The Google Sheet stores only the private blob key, not a public receipt URL. This is intentional because payment receipts may contain personal or financial information.
- Duplicate checks prevent most accidental repeats but are **not atomic**. Two identical simultaneous submissions could both be recorded, because Google Sheets isn't a transactional database.
- Access to the Google Sheet should be restricted to authorized GIST team members. The sheet contains personal contact information.
- Do not publicly expose the service-account JSON key or the private `.env` file.
- Browser requests go to your site's same-origin `/api/register` endpoint. All form fields are revalidated on the server.
- The private dashboard is available only at `/#admin`; all applicant and receipt endpoints return `401` without a valid signed session cookie.
- If you anticipate large volumes or abuse, add a server-side rate limiter and CAPTCHA before public launch.
- A security audit and test on the final deployment is recommended before accepting real student data.
- The supplied desktop and mobile campaign banners are bundled with the application build.

## Editing or extending using Codex

See `CODEX_PROMPT.md` for a ready-to-paste prompt that tells Codex how to improve this existing project without changing the established form fields.
