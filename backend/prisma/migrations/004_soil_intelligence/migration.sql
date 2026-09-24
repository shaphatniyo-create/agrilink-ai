-- ============================================================================
-- AgriLink AI - migration 004: Soil intelligence
--
-- Implements the "sensor -> reference data -> crop requirements -> comparison
-- engine -> AI recommendation" pipeline:
--
--   rwanda_soils                -> "SoilReference"      (reference soil points,
--                                   cached from ISRIC SoilGrids 2.0 or imported
--                                   from RwaSIS/RAB files later)
--   crops (requirement fields)  -> "CropSoilRequirement" (1:1 with "Crop")
--   crop_soil_requirements      -> "CropSoilRequirement"
--   fertilizer_recommendations  -> "FertilizerRecommendation"
--   lime_recommendations        -> "LimeRecommendation"
--   sensor_readings             -> existing "SoilReading" (+ latitude/longitude)
--   ai_recommendations          -> "AiRecommendation"
--   rwanda_locations            -> existing "AdminArea" (province..village)
--
-- Reference rows (seeded by the backend) carry their source in "source"/"sourceUrl".
-- Rows marked "AgriLink default" are working values with NO published source
-- and must be calibrated (e.g. against RAB soil-lab results) before being
-- presented as official advice.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Sensor readings: GPS position of the probe (optional, sent by the ESP32)
-- ---------------------------------------------------------------------------
ALTER TABLE "SoilReading" ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE "SoilReading" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ---------------------------------------------------------------------------
-- New tables. Existing databases differ in the id column type (uuid when
-- built from these migrations, text when the schema was created with
-- `prisma db push`), so foreign-key columns follow whatever "Farm".id uses.
-- ---------------------------------------------------------------------------
DO $$
DECLARE idtype text;
BEGIN
  SELECT CASE WHEN data_type = 'uuid' THEN 'uuid' ELSE 'text' END INTO idtype
  FROM information_schema.columns
  WHERE table_schema = current_schema() AND table_name = 'Farm' AND column_name = 'id';
  EXECUTE format('CREATE TABLE "SoilReference" (
  id %1$s PRIMARY KEY DEFAULT gen_random_uuid()::%1$s,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  "areaId" %1$s REFERENCES "AdminArea"(id) ON DELETE SET NULL,
  "depthLabel" TEXT NOT NULL DEFAULT ''0-30cm'',
  "soilType" TEXT,
  texture TEXT,
  ph DOUBLE PRECISION,
  "nitrogenGKg" DOUBLE PRECISION,        -- total N, g/kg
  "phosphorusMgKg" DOUBLE PRECISION,     -- available P, mg/kg (RwaSIS / iSDA; not in SoilGrids)
  "potassiumMgKg" DOUBLE PRECISION,      -- exchangeable K, mg/kg (RwaSIS / iSDA; not in SoilGrids)
  "organicCarbonGKg" DOUBLE PRECISION,   -- SOC, g/kg
  "cecCmolKg" DOUBLE PRECISION,          -- CEC, cmol(+)/kg
  "clayPct" DOUBLE PRECISION,
  "sandPct" DOUBLE PRECISION,
  "siltPct" DOUBLE PRECISION,
  source TEXT NOT NULL,
  "sourceUrl" TEXT,
  raw JSONB,
  "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
)', idtype);
  EXECUTE format('CREATE INDEX ON "SoilReference"(latitude, longitude)', idtype);
  EXECUTE format('CREATE INDEX ON "SoilReference"("areaId")', idtype);
  EXECUTE format('CREATE TABLE "CropSoilRequirement" (
  id %1$s PRIMARY KEY DEFAULT gen_random_uuid()::%1$s,
  "cropId" %1$s NOT NULL UNIQUE REFERENCES "Crop"(id) ON DELETE CASCADE,
  variety TEXT,
  "phMin" DOUBLE PRECISION NOT NULL,
  "phMax" DOUBLE PRECISION NOT NULL,
  "phAbsMin" DOUBLE PRECISION,
  "phAbsMax" DOUBLE PRECISION,
  "nitrogenMinPpm" DOUBLE PRECISION,
  "nitrogenMaxPpm" DOUBLE PRECISION,
  "phosphorusMinPpm" DOUBLE PRECISION,
  "phosphorusMaxPpm" DOUBLE PRECISION,
  "potassiumMinPpm" DOUBLE PRECISION,
  "potassiumMaxPpm" DOUBLE PRECISION,
  "moistureMinPct" DOUBLE PRECISION,
  "moistureMaxPct" DOUBLE PRECISION,
  "waterRequirement" TEXT,
  "maturityDays" INTEGER,
  "limeResponsive" BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL,
  "sourceUrl" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
)', idtype);
  EXECUTE format('CREATE TABLE "FertilizerRecommendation" (
  id %1$s PRIMARY KEY DEFAULT gen_random_uuid()::%1$s,
  "cropId" %1$s NOT NULL REFERENCES "Crop"(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                    -- e.g. BR, SSR1, SSR2, SSR3
  name TEXT NOT NULL,
  "dapKgHa" DOUBLE PRECISION,
  "npk171717KgHa" DOUBLE PRECISION,
  "ureaKgHa" DOUBLE PRECISION,
  "kclKgHa" DOUBLE PRECISION,
  "totalNKgHa" DOUBLE PRECISION,
  "nitrogenLevel" TEXT,                  -- sensor N band this option suits: LOW | MEDIUM | HIGH | ANY
  timing TEXT,
  source TEXT NOT NULL,
  "sourceUrl" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("cropId", code)
)', idtype);
  EXECUTE format('CREATE TABLE "LimeRecommendation" (
  id %1$s PRIMARY KEY DEFAULT gen_random_uuid()::%1$s,
  "phFrom" DOUBLE PRECISION NOT NULL,    -- inclusive
  "phTo" DOUBLE PRECISION NOT NULL,      -- exclusive
  "fertilityClass" TEXT NOT NULL,        -- INFERTILE | MEDIUM | FERTILE
  product TEXT,
  "rateTHa" DOUBLE PRECISION,
  "altRateTHa" DOUBLE PRECISION,
  frequency TEXT,
  advice TEXT NOT NULL,
  source TEXT NOT NULL,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
)', idtype);
  EXECUTE format('CREATE TABLE "AiRecommendation" (
  id %1$s PRIMARY KEY DEFAULT gen_random_uuid()::%1$s,
  "farmId" %1$s NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  "cropId" %1$s REFERENCES "Crop"(id) ON DELETE SET NULL,
  "readingId" %1$s REFERENCES "SoilReading"(id) ON DELETE SET NULL,
  "soilReferenceId" %1$s REFERENCES "SoilReference"(id) ON DELETE SET NULL,
  "suitabilityScore" INTEGER,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "createdById" %1$s REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
)', idtype);
  EXECUTE format('CREATE INDEX ON "AiRecommendation"("farmId", "createdAt" DESC)', idtype);
END $$;

-- Reference data (lime bands, crop requirements, fertilizer options) is
-- seeded idempotently at backend startup from
-- src/soil-intel/knowledge/reference-data.ts, so it also lands on fresh
-- databases where crops are seeded after migrations.

COMMIT;
