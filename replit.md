# Quality Check

AI-powered quality control app for manufacturing inspection, SPC analysis, and data export.

## Run & Operate

- `pnpm --filter @workspace/quality-check run dev` — run the Quality Check app (port 20776)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite, Tailwind CSS v4, shadcn/ui components
- Routing: wouter (replaces Next.js router)
- Auth & DB: Firebase Auth + Firestore + Firebase Storage
- Charts: Recharts (SPC analysis charts)
- Forms: react-hook-form + zod
- Date: date-fns + react-day-picker v9
- CSV: papaparse

## Where things live

- `artifacts/quality-check/src/` — React Vite app source
- `artifacts/quality-check/src/pages/` — login.tsx, dashboard.tsx
- `artifacts/quality-check/src/components/` — UI components (header, tabs)
- `artifacts/quality-check/src/lib/firebase.ts` — Firebase config & exports
- `artifacts/quality-check/src/index.css` — Theme (HSL CSS variables, pink/crimson primary)

## Architecture decisions

- Firebase-only backend (no Postgres/Drizzle ORM used in this app)
- Server-side Genkit AI flows (spcFromStorageFlow, generateReportsFlow, dailyExportFlow) were removed from the Vite client — SPC analysis now runs directly against Firestore measurements instead of Firebase Storage CSVs
- Role-based dashboard: managers see all 5 tabs (Users, CheckSheet, SPC, Inspection, Export); inspectors see only Inspection tab
- Recent measurements stored in a separate `recent_measurements` Firestore collection for fast real-time queries (capped at 100 docs, pruned automatically)
- CSV export is fully client-side using papaparse (no cloud function needed)

## Product

- **Login** — Firebase Auth with remember-me persistence
- **Users tab** — Managers can add inspector/manager accounts
- **Check Sheet tab** — Define items with measurement fields (Numeric/Boolean/Text), LSL/USL spec limits, and SPC special characteristics
- **SPC tab** — Statistical Process Control analysis (Cp/Cpk/Pp/Ppk/PPM) with X-bar, Range, and distribution charts; seed/clear demo data
- **Inspection tab** — Inspectors submit measurements per check sheet; real-time history with edit/delete
- **Export tab** — Download measurements as CSV by department + date range

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- react-day-picker v9 is installed (not v8); `DateRange` import is from `react-day-picker` directly
- Firebase SDK v12 (modular) is used throughout — no compat imports
- The SPC tab reads directly from Firestore `measurements` collection (not from Firebase Storage CSVs like the original Genkit flow did)
- Firestore composite indexes may be needed for queries with multiple `where` + `orderBy` clauses

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
