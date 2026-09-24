-- ============================================================================
-- AgriLink AI - migration 003: IoT field sensors
-- Adds: IotDevice (ESP32 + GSM module registration, device-secret auth),
-- SoilReading (NPK/pH/moisture/temperature + DC pump state pushed by the
-- device), SensorAlert (auto-generated on threshold breach or device
-- silence -- read-only display on the farmer dashboard).
-- ============================================================================

BEGIN;

CREATE TYPE "IotDeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PumpState" AS ENUM ('ON', 'OFF');
CREATE TYPE "SensorAlertType" AS ENUM (
  'LOW_MOISTURE', 'HIGH_MOISTURE', 'LOW_NITROGEN', 'LOW_PHOSPHORUS',
  'LOW_POTASSIUM', 'PH_LOW', 'PH_HIGH', 'DEVICE_OFFLINE'
);

CREATE TABLE "IotDevice" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  "deviceCode" TEXT NOT NULL UNIQUE,
  "apiKeyHash" TEXT NOT NULL,
  label TEXT,
  status "IotDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastSeenAt" TIMESTAMPTZ,
  "createdById" UUID NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "IotDevice"("farmId");

CREATE TABLE "SoilReading" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "deviceId" UUID NOT NULL REFERENCES "IotDevice"(id) ON DELETE CASCADE,
  "farmId" UUID NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  "moisturePct" DOUBLE PRECISION,
  "temperatureC" DOUBLE PRECISION,
  ph DOUBLE PRECISION,
  "nitrogenPpm" DOUBLE PRECISION,
  "phosphorusPpm" DOUBLE PRECISION,
  "potassiumPpm" DOUBLE PRECISION,
  "pumpState" "PumpState",
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "SoilReading"("deviceId");
CREATE INDEX ON "SoilReading"("farmId");
CREATE INDEX ON "SoilReading"("recordedAt");

CREATE TABLE "SensorAlert" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  "deviceId" UUID NOT NULL REFERENCES "IotDevice"(id) ON DELETE CASCADE,
  "alertType" "SensorAlertType" NOT NULL,
  severity "WeatherAlertSeverity" NOT NULL DEFAULT 'ADVISORY',
  message TEXT NOT NULL,
  recommendation TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "SensorAlert"("farmId");
CREATE INDEX ON "SensorAlert"("deviceId");
CREATE INDEX ON "SensorAlert"("resolvedAt");

COMMIT;
