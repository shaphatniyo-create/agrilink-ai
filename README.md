# AgriLink AI

A national agricultural digital ecosystem for Rwanda: farmers, cooperatives, buyers, input
suppliers, transporters, financial partners, and AgriLink HQ on one platform — architected to
scale to all 30 districts / 416 sectors / 2,148 cells / 14,837 villages, while launching in a
handful of pilot districts and crops today.

See `docs/ARCHITECTURE.md` for the full system design, `docs/DEPLOYMENT.md` to run it, and
`docs/ROADMAP.md` for the path from this pilot build to national scale.

## Stack

- **Backend**: NestJS (TypeScript) + PostgreSQL via Prisma ORM, JWT auth, role/geo-scoped RBAC
  enforced at the API layer.
- **Frontend**: React + Vite + TypeScript + Tailwind, i18next (English / French / Kinyarwanda),
  mobile-responsive.
- **Database**: PostgreSQL, 45 tables covering geography, RBAC, crops, farms, marketplace,
  input supply, transport, payments, the commission/revenue engine, subscriptions, advertising,
  communication, and finance.

## Quickstart (Docker)

```bash
docker compose up --build
```

- Backend API: http://localhost:4000/api/v1 (Swagger docs at `/api/docs`)
- Frontend: http://localhost:8080
- Postgres: localhost:5432 (postgres/postgres/agrilink)

The backend container runs `prisma migrate deploy` on boot, applying `prisma/migrations/000_init`.
Seed the demo data once the stack is up:

```bash
docker compose exec backend npm run prisma:seed
```

## Demo accounts

Every seeded user's password is **`AgriLink@2026`**. Sign in with either the phone number or
email shown (the login field accepts either):

| Role | Phone / email |
|---|---|
| **Founding Super Admin** | shaphatniyo@gmail.com |
| Helper Admin (demo) | helper.admin@agrilink.rw |
| Super Admin (demo) | +250780000001 |
| CEO | +250780000002 |
| DAF | +250780000003 |
| District Leader (Musanze) | +250780000008 |
| Farmer | +250780000012 |
| Buyer | +250780000015 |
| Supplier | +250780000016 |
| Transporter | +250780000017 |

(Full list of 23 seeded users/roles in `backend/prisma/seed.sql`.)

New accounts can also self-register at `/register`, or sign up with Google once
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set (see `backend/.env.example`) -- either way, a
Super Admin or Helper Admin must approve the account (`/admin-approvals`) before it can sign in.

## Repository layout

```
backend/    NestJS API, Prisma schema + hand-verified SQL migration, seed data
frontend/   React app (role-based dashboards, marketplace, geo/crop admin, DAF finance, org chart)
docs/       Architecture, deployment, and roadmap documentation
docker-compose.yml
```

## A note on how this was built

This build was produced in a sandboxed environment with no access to npm/PyPI/apt package
registries, so the backend and frontend dependencies could not be `npm install`-ed or
build-verified in that sandbox. What *was* verified for real, in that same environment:

- The complete 45-table PostgreSQL schema was executed against a live Postgres instance with
  zero errors (`backend/prisma/migrations/000_init/migration.sql`).
- The full seed dataset — Rwanda's real 5-province/30-district structure, pilot sectors/cells/
  villages, 20 role-scoped demo users, 5 pilot crops, commission rules, subscription plans,
  payment providers, transport fee config, and a complete farm→listing→order→transport→payment→
  commission chain with correct arithmetic — loaded and was queried back successfully
  (`backend/prisma/seed.sql`).
- Every TypeScript file's relative imports were checked to resolve to a real file, and every
  file's braces/parens were checked balanced (73 backend files, 28 frontend files, 0 problems).

What was **not** run in that sandbox: `npm install`, a TypeScript compile/typecheck, or booting
the Nest/Vite dev servers, since no package registry was reachable there. Run
`npm install` in both `backend/` and `frontend/` (or `docker compose up --build`, which builds on
your machine/CI with normal network access) as the first step anywhere with standard internet
access, and treat that as the real first build/typecheck this code will get.
