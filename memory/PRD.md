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

## What's been implemented (grows over time)
- 2026-09-14 (iter 1): Auth + full data model, Dashboard, Job Detail (Estimate/Log/Expenses), Clients, Rate Card, Settings, seed data, object storage. Tested 100%.
- 2026-09-14 (iter 2): Full design-system replacement (near-black #12110F / elevated #1C1A17, warm greys, bone #F5F1EA primary actions, signal blue #2F7DE1 interactive, green/amber/red profit-only semantics, IBM Plex Sans w/ tabular-nums, no gradients/shadows/radius>8px, filled status pills, borderless stat tiles, job card = client → address → money → pill). NEW centerpiece: Estimate from photos — typed description (primary) + optional whisper-1 voice note, 1–5 photos analyzed by gpt-5.4 vision for SCOPE ONLY (never dimensions/prices), photo-vs-description mismatches surfaced as include/exclude questions, dimension form with "assumed — confirm" badges, rate-card-only line building with needs_price flags resolved inline (+ "Save to my rate card" with de-dup), zero-qty lines flagged, Generate quote blocked until all lines priced, Save as draft always allowed, 816px US Letter quote document overlay (logo, client, scope, lines, totals, 30-day validity, terms) with print CSS. Tested 100% backend (10/10 pytest) + frontend critical flows.

## Backlog / next up
- P1: PDF export of the quote document (next prompt per user)
- P1: Invoice entity + tab
- P2: Job cover photo picker UI (backend field exists)
- P2: Regional cost adjustment on rate card seed
- P3: <span> in <option> hydration warning from ve dev overlay (cosmetic, external)

## Test credentials
See `/app/memory/test_credentials.md`. Each user gets isolated seed data. Email domain must be routable (example.com works; .test does not).
