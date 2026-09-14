# Jobsite — status report and open decisions

## Seven priority items

1. **Auth, company profile, and full data model — COMPLETE.**
   Email/password auth with JWT + bcrypt is live. Company profile (business name, phone, email, address, license number, default tax rate, payment instructions, logo) is stored on the user and editable in Settings. All eight entities from the spec exist and persist: User, Company (embedded), RateCard, Client, Job, Estimate, Expense, LogEntry, HoursEntry.

2. **Rate Card with inline editing — COMPLETE.**
   25 seeded items across labor, material, equipment, disposal. Name, unit, unit price, category are all inline-editable and save to the server on change. Add and remove rows work. A "prices confirmed" check per row exists; unreviewed rows are visibly flagged with an amber border, and a banner at the top counts how many are still unconfirmed.

3. **Clients and Jobs full CRUD — COMPLETE.**
   Both support list, create, read, update, and delete. Delete on a client or a job archives it (soft delete) instead of hard-deleting, so revenue history is preserved. Jobs get a sequential job number visible on cards and on the detail screen.

4. **Job detail screen — COMPLETE.**
   Header shows job number, title, client, address, status, tap-to-call, and the three money metrics (contract, costs, profit + %). Status picker cycles all seven statuses. Three tabs: Estimate (line items with rate-card add, subtotal, tax, grand total in large orange), Field Log (dated notes + camera photo capture), Expenses (vendor, date, amount, category, receipt photo + running job cost total). Crew hours entry is inside the Log tab as an expandable section.

5. **Dashboard with stat tiles — COMPLETE.**
   Four stat tiles: Open Estimates, Approved Work, Unbilled Expenses, Profit This Month. Below them, jobs grouped by status. Each job card shows client, address, contract total, costs to date, profit in dollars and percent.

6. **Seed demo data — COMPLETE.**
   Registering a new account auto-seeds: 25 rate-card items (painting depth plus universal trades), 3 realistic clients, 4 jobs at Lead / Approved / In Progress / Paid. In Progress and Paid jobs have real estimate line items, expenses, and dated log entries. Verified with a fresh registration during testing: dashboard renders four job cards with non-zero contract/costs/profit and stat tiles Approved Work $12,510.99, Unbilled Expenses $1,100.55, Profit This Month $1,925.35.

7. **Design and mobile polish — COMPLETE.**
   Dark slate #0B0F17 / #131B26 with safety orange #FF5F15 accent. Barlow Condensed for industrial headings, JetBrains Mono for money numbers, Inter for body. No gradients, no emoji, no stock illustrations. 48px minimum tap targets on all interactive elements. Layout is single-column max-w-md on mobile, widens to max-w-5xl on desktop with a top nav bar; mobile has a bottom nav bar.

## Explicitly not built (matches your instructions)

- No invoice tab or invoice entity. Deferred as you requested.
- No drag-and-drop, no SMS, no payment processing, no e-signature.
- No marketing, pricing, or signup-funnel pages. The app opens straight to auth.
- Regional cost adjustment on the rate card was not built. You allowed skipping it; template prices are national-average and every row starts unconfirmed until the user reviews it.

## Three specific confirmations you asked for

- **Rate card edits persist after reload — yes.** Every field change (name, unit, price, category, confirmed flag) calls `PUT /api/rate-card/{id}` immediately. The Rate Card page reads from `GET /api/rate-card` on mount, so refreshing the page or coming back later shows the last saved value. Verified by the test agent: two sequential PUTs on the same row return the updated value.

- **Image upload stores an object URL, not base64 — yes.** All uploads (logo, receipt, job log photos, cover photo) go through `POST /api/files/upload`. The bytes are resized to 1600px on the long edge at 80% JPEG quality plus a thumbnail, both pushed to Emergent object storage. MongoDB stores only `storage_path`, `thumb_path`, filename, size, content type, and timestamps — no image data in the database. Images render via `GET /api/files/{id}?thumb=true` (list views) or without `thumb` (full-size).

- **Seeded demo data visible on the dashboard — yes.** Confirmed live: a freshly registered account lands on the Board with four job cards grouped by status (Lead, Approved, In Progress, Paid), non-zero money on every card that has an estimate, and all four stat tiles filled in.

## Open decisions for you

These are the choices that would shape the next build round. Nothing here changes what is already shipped.

1. **Invoicing.** You told me to defer it and give it its own data model. When you want to build it, decide whether an invoice is generated from an approved estimate (locked snapshot) or is a fresh line-item document. That decision drives the schema.

2. **Job cover photo.** Backend already accepts a `cover_photo_id` on a job, but there is no upload button on the job detail screen yet. Small addition — worth confirming you want it on the job detail header (versus, say, a gallery under the Log tab).

3. **Estimate PDF export.** Spec mentions US Letter documents. Not built. If you want it soon, it needs a decision on whether to render server-side (WeasyPrint / ReportLab) or client-side (browser print CSS).

4. **Regional pricing on rate card seed.** You said skip if it adds meaningful complexity; it was skipped. If you want it later, the shape is: ask for state or ZIP during first-run of the Rate Card, apply a percentage multiplier to template prices, preview before save. Adds one screen and a lookup table.

5. **Low-priority console noise.** A React hydration warning ("<span> cannot be a child of <option>") appears from the dev overlay wrapping the native select on Job Detail. No functional impact. Fixable by switching that dropdown to the Radix Select component. Worth doing only if it bothers you.
