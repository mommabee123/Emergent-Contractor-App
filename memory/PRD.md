# Jobsite — PRD & Progress

## Original problem statement
Mobile-first web app for solo contractors / small trade crews (painters, remodelers, roofers, landscapers, handymen). Every piece of data attaches to a JOB record. Dark slate + safety orange, industrial sans-serif, 390px mobile-first, money is the biggest thing on screen.

## User & scope
- Single user per account (one user = one company). No teams, no roles, no multi-tenancy.
- USD currency, US date format, US Letter documents.
- Deleting a client or job archives it (soft delete).
- Jobs get sequential job_number visible on cards and detail.

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT auth (bcrypt). All routes under `/api`.
- Frontend: React 19 + react-router-dom + Tailwind + shadcn/ui + sonner. Barlow Condensed / Inter / JetBrains Mono.
- Object storage: Emergent object storage for logo/receipt/log/cover photos with server-side resize to 1600px + thumbnail generation.

## Priority list (all seven complete on this pass)
- [x] 1. Auth + Company profile + full data model (User, Company, RateCard, Client, Job, Estimate, Expense, LogEntry, HoursEntry)
- [x] 2. Rate Card screen with working inline editing + confirmed flag
- [x] 3. Clients and Jobs full CRUD (archive on delete)
- [x] 4. Job detail screen (Estimate / Log / Expenses tabs, hours accordion)
- [x] 5. Dashboard with 4 stat tiles + status-grouped job cards
- [x] 6. Seed demo data (25 rate items, 3 clients, 4 jobs across Lead/Approved/In Progress/Paid with estimates, expenses, logs)
- [x] 7. Design & mobile polish (dark slate + safety orange, 48px tap targets, mobile bottom nav → desktop top nav)

## Explicitly NOT built (per spec)
- Invoice tab / invoice entity (deferred, will have its own data model)
- Drag-and-drop editor, SMS, payment processing, e-signature
- Marketing / landing / pricing / signup funnel pages
- Regional cost adjustment on rate card (deferred — user allowed it to be skipped)

## Backlog / next up
- P1: Invoice entity + tab (separate data model, generate from estimate)
- P1: Job cover photo upload UI on job detail (backend supports cover_photo_id, form control not wired yet)
- P2: Estimate PDF export (US Letter)
- P2: Regional cost adjustment on rate card seed (state/metro dropdown)
- P2: Per-client lifetime revenue optimized in a single API call
- P3: Silence <span> in <option> hydration warning (LOW impact, only ve dev overlay)

## Test credentials
See `/app/memory/test_credentials.md`. Each user gets isolated seed data. Email domain must be routable (example.com works; .test does not).
