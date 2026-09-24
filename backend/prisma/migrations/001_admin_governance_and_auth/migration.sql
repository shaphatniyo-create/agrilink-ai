-- ============================================================================
-- AgriLink AI - migration 001: admin governance + flexible auth
-- Adds: HELPER_ADMIN role; dual-approval admin-creation workflow
-- (ApprovalRequest); email verification tokens; Google Sign-In support
-- (optional phone/passwordHash, googleId, emailVerifiedAt on User).
-- Executed directly against Postgres (see migration 000_init's header for why).
-- ============================================================================

BEGIN;

-- New role + status values -----------------------------------------------
ALTER TYPE "UserRole" ADD VALUE 'HELPER_ADMIN';
ALTER TYPE "UserStatus" ADD VALUE 'REJECTED';

-- Flexible auth on User: phone becomes optional (Google sign-up may supply
-- only an email), passwordHash becomes optional (Google-only accounts have
-- none), plus Google linkage + email verification tracking.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ;

COMMIT;

-- New enum values must be committed before they can be referenced by name
-- in a later statement in the same session, so the remaining DDL runs in a
-- fresh transaction.
BEGIN;

CREATE TYPE "ApprovalRequestType" AS ENUM ('NEW_SUPER_ADMIN','NEW_HELPER_ADMIN','USER_REGISTRATION');
CREATE TYPE "ApprovalDecisionStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE "EmailTokenPurpose" AS ENUM ('VERIFY_EMAIL','PASSWORD_RESET');

CREATE TABLE "ApprovalRequest" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type "ApprovalRequestType" NOT NULL,
  "targetUserId" UUID REFERENCES "User"(id),
  "proposedRole" "UserRole",
  "proposedGeoAreaId" UUID REFERENCES "AdminArea"(id),
  "proposedDepartmentId" UUID REFERENCES "Department"(id),
  "requestedById" UUID NOT NULL REFERENCES "User"(id),
  status "ApprovalDecisionStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" UUID REFERENCES "User"(id),
  "coSignedById" UUID REFERENCES "User"(id),
  "decisionNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "decidedAt" TIMESTAMPTZ
);
CREATE INDEX ON "ApprovalRequest"(status);
CREATE INDEX ON "ApprovalRequest"(type, status);
CREATE INDEX ON "ApprovalRequest"("targetUserId");

CREATE TABLE "EmailVerificationToken" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL,
  purpose "EmailTokenPurpose" NOT NULL DEFAULT 'VERIFY_EMAIL',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "EmailVerificationToken"("userId");
CREATE INDEX ON "EmailVerificationToken"("tokenHash");

COMMIT;
