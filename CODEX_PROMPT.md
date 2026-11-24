# Codex prompt — GIST Scholarship Registration Portal

You are working in an existing Vite + React + TypeScript app named `gist-scholarship-registration`. Review the code before editing. Make it polished, secure, and fully deployable to Netlify. Preserve the dashboard and short two-step registration flow unless GIST explicitly requests another change. Do not add unnecessary student questions.

This is for Glamour Institute of Science & Technology (GIST), Sukkur, Scholarship Program 2026. The scholarship test has three groups: Elementary, Secondary & Higher Secondary, and Undergraduate. Students must not choose a category; GIST assigns it later from their education details.

Requirements:
1. Mobile-first attractive institutional design with GIST branding, accessible progress wizard and polished success state.
2. Step 1: full name, optional father/guardian name, gender, WhatsApp/mobile, and city/district.
3. Step 2: education level, class/year/semester (based on level), institution name, one preferred course, Easypaisa details, and one required payment receipt.
4. Explain that GIST assigns the category, students can change to any offered course later, scholarships are based on test performance, and the top performer in each category receives a laptop.
5. Shared client/server validation: Pakistan phone number formats, required fields, and enum values.
6. Save new students in Netlify Database and store receipts privately in Netlify Blobs. Never send private credentials to the browser. Read env vars VITE_EASYPAISA_ACCOUNT_TITLE, VITE_EASYPAISA_ACCOUNT_NUMBER, ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET.
7. Enforce duplicate protection using normalized student name + WhatsApp; return a friendly 409. Assign a unique registration ID and display it only after the database insert succeeds.
8. Ensure the Netlify serverless deployment works; provide clear setup documentation.
9. Test: frontend build, validation, API error states, database migration, registration, admin data, receipt access and export.
10. Do not claim a live deployment or connected database unless it has actually been configured and tested.

Prefer modest, auditable dependencies and a straightforward architecture. Preserve the shared options and documented column order. Improve and document any weaknesses you find.
