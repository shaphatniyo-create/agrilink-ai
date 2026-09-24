# Deployment

## Local (Docker Compose — recommended first run)

```bash
docker compose up --build
docker compose exec backend npm run prisma:seed   # once, after first boot
```

- API: http://localhost:4000/api/v1 · Swagger: http://localhost:4000/api/docs
- Frontend: http://localhost:8080
- The `backend` container runs `prisma migrate deploy` automatically on every boot.

## Local (without Docker)

```bash
# 1. Postgres running locally, then:
cd backend
cp .env.example .env   # edit DATABASE_URL / JWT secrets
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev       # http://localhost:4000

cd ../frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

## Railway

This repo is structured as two Railway services (backend, frontend) plus a managed Postgres
plugin:

1. **Create a Postgres database** on Railway (one click — "New" → "Database" → "PostgreSQL").
   Railway injects `DATABASE_URL` into services in the same project automatically if you
   reference it as a variable (`${{Postgres.DATABASE_URL}}`).
2. **Backend service**: deploy `backend/` (Railway auto-detects the `Dockerfile`). Set env vars
   `DATABASE_URL` (from step 1), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   `JWT_ACCESS_EXPIRES=15m`, `JWT_REFRESH_EXPIRES=30d`. The container's `CMD` runs
   `prisma migrate deploy` before starting, so the schema applies on every deploy. Generate a
   domain for it (Settings → Networking → Generate Domain).
3. **Seed once**, from a Railway shell on the backend service (or `railway run` locally against
   the Railway `DATABASE_URL`): `npm run prisma:seed`.
4. **Frontend service**: deploy `frontend/` (its `Dockerfile` builds a static bundle served by
   nginx). Set build arg / env var `VITE_API_BASE_URL` to the backend's public domain +
   `/api/v1`. Generate a domain for it too.

### Deploying from this session

Railway's `create-deployment` API deploys **from a GitHub repository already connected to your
Railway account** — it does not accept a raw local directory upload. This build was produced in a
sandboxed environment with no package-registry access, so it could not be `npm install`-ed or
smoke-tested there; the code is ready to push, but pushing it to your GitHub and wiring it to
Railway is the one step that needs your account (either connect a GitHub connector in this
session, or tell me the `owner/repo` of a repo you've already connected to Railway, and I'll take
it from there).

Alternative: `railway up` from your own machine (with the Railway CLI installed and
`railway login` done) inside `backend/` and `frontend/` deploys directly from local source without
GitHub.

## Environment variables reference

**Backend** (`backend/.env.example`): `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `PORT`, `NODE_ENV`, and per-provider payment
credentials (`MTN_MOMO_API_KEY` etc. — fill in once issued; the app runs against the `MOCK`
provider without them).

**Frontend** (`frontend/.env.example`): `VITE_API_BASE_URL`.

## First production checklist

- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` to real random secrets (never the `.env.example`
  placeholders).
- Change every seeded demo user's password (they all share `AgriLink@2026`) or delete the seed
  users entirely before going live.
- Fill in a real `PaymentAdapter` (MTN MoMo, Airtel Money, card processor) and flip the relevant
  `PaymentProvider.isActive`/adapter registration — see `docs/ARCHITECTURE.md` §5.
- Import the full NISR administrative gazetteer (416 sectors / 2,148 cells / 14,837 villages) to
  replace the placeholder pilot sector/cell/village rows in `AdminArea` — the schema already
  supports it with zero migration changes, this is a data load only.
- Point `docker-compose.yml` / Railway at managed Postgres with backups enabled, not a
  single-container database.
