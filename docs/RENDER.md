# Hosting AgriLink AI on Render (free plan)

`render.yaml` in the repository root is a Render Blueprint that creates:

| Resource | Render type | Plan |
|---|---|---|
| `agrilink-db` | PostgreSQL | Free (1 GB, **expires after 30 days**) |
| `agrilink-api` | Node web service (`backend/`) | Free (sleeps after ~15 min idle) |
| `agrilink-web` | Static site (`frontend/`) | Free |

## Steps

1. Push this folder to a GitHub repository (the root `.gitignore` keeps
   `node_modules`, `dist`, `.env` files and logs out of it).
2. In Render: **New > Blueprint**, connect GitHub, pick the repository.
3. Render asks for three values:
   - `SEED_ADMIN_PASSWORD`: the password for the founding Super Admin
     (`shaphatniyo@gmail.com`) on the hosted site. At least 10 characters.
   - `FRONTEND_URL`: `https://agrilink-web.onrender.com` (or the URL Render shows).
   - `BACKEND_URL`: `https://agrilink-api.onrender.com` (or the URL Render shows).
4. Click **Apply**. The first deploy takes several minutes.

On first boot the API creates the tables (`prisma db push`), loads the seed data
(`scripts/bootstrap-db.js`), sets the Super Admin password and locks the other
demo accounts (they share a public password). Soil/crop reference data is
seeded automatically when the API starts.

## Free-plan limits to plan around

- The API sleeps after 15 minutes without traffic; the next request waits
  about a minute. The ESP32 should retry failed uploads.
- The free database is deleted 30 days after creation unless upgraded.
- No shell or pre-deploy command on free services, which is why schema sync
  and seeding run in the start command.
- Only HTTPS reaches the API: the ESP32 must post to
  `https://<api-host>/api/v1/iot/ingest` (the local MQTT bridge is not
  available on Render).
