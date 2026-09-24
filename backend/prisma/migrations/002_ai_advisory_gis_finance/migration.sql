-- ============================================================================
-- AgriLink AI - migration 002: AI advisory, GIS farm zones, farm bookkeeping
-- Adds: FarmZone (GIS boundary/soil/irrigation polygons), FarmExpense/
-- FarmIncome (per-farm bookkeeping), AiDiagnosis (Plant Doctor/Agronomist/
-- Farm Planner/Financial Advisor interaction log), WeatherAlert.
-- ============================================================================

BEGIN;

CREATE TYPE "AiEngineType" AS ENUM ('PLANT_DOCTOR', 'AGRONOMIST', 'FARM_PLANNER', 'FINANCIAL_ADVISOR');
CREATE TYPE "WeatherAlertType" AS ENUM ('RAIN', 'FLOOD', 'DROUGHT', 'WIND', 'FROST', 'LIGHTNING');
CREATE TYPE "WeatherAlertSeverity" AS ENUM ('ADVISORY', 'WATCH', 'WARNING');
CREATE TYPE "FarmZoneType" AS ENUM ('BOUNDARY', 'SOIL', 'IRRIGATION', 'CROP_HEALTH');

CREATE TABLE "FarmZone" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "zoneType" "FarmZoneType" NOT NULL,
  boundary JSONB NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "FarmZone"("farmId");

CREATE TABLE "FarmExpense" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  note TEXT,
  "incurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdById" UUID NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "FarmExpense"("farmId");
CREATE INDEX ON "FarmExpense"("incurredAt");

CREATE TABLE "FarmIncome" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  note TEXT,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdById" UUID NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "FarmIncome"("farmId");
CREATE INDEX ON "FarmIncome"("receivedAt");

CREATE TABLE "AiDiagnosis" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  "farmId" UUID REFERENCES "Farm"(id),
  "cropId" UUID REFERENCES "Crop"(id),
  "engineType" "AiEngineType" NOT NULL,
  "inputText" TEXT,
  "inputImageNote" TEXT,
  findings JSONB NOT NULL,
  recommendation TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "AiDiagnosis"("userId");
CREATE INDEX ON "AiDiagnosis"("farmId");
CREATE INDEX ON "AiDiagnosis"("engineType");

CREATE TABLE "WeatherAlert" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "geoAreaId" UUID NOT NULL REFERENCES "AdminArea"(id),
  "alertType" "WeatherAlertType" NOT NULL,
  severity "WeatherAlertSeverity" NOT NULL DEFAULT 'ADVISORY',
  message TEXT NOT NULL,
  recommendation TEXT,
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ,
  "createdById" UUID NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "WeatherAlert"("geoAreaId");
CREATE INDEX ON "WeatherAlert"("alertType");
CREATE INDEX ON "WeatherAlert"("startsAt");

COMMIT;
