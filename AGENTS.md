# AGENTS.md

## Cursor Cloud specific instructions

Full-stack Municipal Revenue Management System. Standard setup/run/API docs live in `README.md` and `SUPABASE_SETUP.md`; commands live in `backend/package.json` and `frontend/package.json`. Notes below are the non-obvious, durable caveats for this cloud environment.

### Services
- **Backend** (`backend/`): Express + TypeScript API on port `5000`. Dev: `npm run dev` (ts-node-dev, hot reload). Build: `npm run build`. Tests: `npm test` (Jest; the suite mocks the DB, so it runs without a live database). `npm run lint` is defined but there is **no ESLint config committed**, so lint fails/prompts in both packages — treat lint as unavailable unless a config is added.
- **Frontend** (`frontend/`): Next.js 14 App Router on port `3000`. Dev: `npm run dev`. Build: `npm run build`. `npm run lint` (`next lint`) is **interactive** (no config) — do not run it non-interactively.
- **Database**: local PostgreSQL 16, DB name `municipal_revenue`.

### Environment / startup caveats (not handled by the update script)
- **PostgreSQL is not auto-started on VM boot.** Start it before running the backend: `sudo pg_ctlcluster 16 main start`.
- Local DB credentials used by `backend/.env`: user `postgres`, password `postgres`, `DATABASE_SSL=false`. `backend/.env` and `frontend/.env.local` are gitignored and already created in the environment; recreate them from `backend/.env.example` if missing (frontend needs `NEXT_PUBLIC_API_URL=http://localhost:5000/api`).
- The backend refuses to start if the DB connection fails, so ensure PostgreSQL is up first.
- Schema/seed lives in `database/schema.sql`; apply the extra migration with `cd backend && npm run migrate` (adds trust-phase tables/columns). Load order for a fresh DB: `schema.sql`, then `npm run migrate`.
- **`local_areas` are NOT seeded by `schema.sql`** (only `electoral_areas` are). Customer/property registration requires a `local_area_id`, so the "Local Area / Community" dropdown is empty and registration fails with `local_area_id must be a number` until `local_areas` are populated and linked to `electoral_areas`. The committed `backend/seed-local-areas.js` is gitignored and assumes a `DATABASE_URL` connection string, so it does not work with the local individual-parameter `.env`.

### Default login
Seeded Super Admin: `admin@ganorth.gov.gh` / `admin123` (from `database/schema.sql`).
