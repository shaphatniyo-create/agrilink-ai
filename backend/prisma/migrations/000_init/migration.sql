-- ============================================================================
-- AgriLink AI - initial schema (hand-authored, mirrors prisma/schema.prisma)
-- Executed directly against Postgres in environments where `prisma migrate`
-- cannot reach the binaries.prisma.sh mirror. Safe to also treat as the
-- Prisma "baseline" migration once `prisma migrate resolve --applied 000_init`
-- is run in an environment with full network access.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
CREATE TYPE "GeoLevel" AS ENUM ('COUNTRY','PROVINCE','DISTRICT','SECTOR','CELL','VILLAGE');
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN','CEO','DAF','CTO','AGRICULTURE_MANAGER','FINANCE_MANAGER','PROVINCE_LEADER','DISTRICT_LEADER','SECTOR_LEADER','CELL_LEADER','VILLAGE_LEADER','FARMER','COOPERATIVE','BUYER','SUPPLIER','TRANSPORTER','AGRICULTURAL_EXPERT','MARKETING_PARTNER','B2B_CLIENT','CUSTOMER_SUPPORT');
CREATE TYPE "UserStatus" AS ENUM ('PENDING','ACTIVE','SUSPENDED','DEACTIVATED');
CREATE TYPE "CropCategory" AS ENUM ('CEREAL','TUBER','LEGUME','VEGETABLE','FRUIT','CASH_CROP','INDUSTRIAL','LIVESTOCK_FEED','OTHER');
CREATE TYPE "FarmCropStatus" AS ENUM ('PLANNED','PLANTED','GROWING','HARVESTED','FAILED');
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT','ACTIVE','RESERVED','SOLD','EXPIRED','CANCELLED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING','CONFIRMED','AWAITING_TRANSPORT','IN_TRANSPORT','DELIVERED','COMPLETED','CANCELLED','DISPUTED','REFUNDED');
CREATE TYPE "InputCategory" AS ENUM ('SEED','FERTILIZER','PESTICIDE','TOOL','IRRIGATION_EQUIPMENT','MACHINERY','ANIMAL_FEED','VETERINARY_PRODUCT');
CREATE TYPE "InputOrderStatus" AS ENUM ('PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED','REFUNDED');
CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE','TRICYCLE','PICKUP','TRUCK_SMALL','TRUCK_MEDIUM','TRUCK_LARGE','REFRIGERATED_TRUCK','OTHER');
CREATE TYPE "TransportRequestStatus" AS ENUM ('REQUESTED','QUOTED','ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','CANCELLED','DISPUTED');
CREATE TYPE "ServiceType" AS ENUM ('MARKETPLACE','INPUT_SALE','TRANSPORT','SUBSCRIPTION','ADVERTISING','B2B','AI_SERVICE','TRAINING','FINANCIAL_REFERRAL');
CREATE TYPE "CommissionPayer" AS ENUM ('SELLER','BUYER','SPLIT','SUPPLIER','TRANSPORTER','ADVERTISER','SUBSCRIBER');
CREATE TYPE "CommissionTxStatus" AS ENUM ('PENDING','ACCRUED','SETTLED','REVERSED','WAIVED');
CREATE TYPE "PaymentPurpose" AS ENUM ('MARKETPLACE_ORDER','INPUT_ORDER','TRANSPORT','SUBSCRIPTION','ADVERTISING','B2B_SERVICE','AI_SERVICE','TRAINING','OTHER');
CREATE TYPE "PaymentTxStatus" AS ENUM ('PENDING','PROCESSING','SUCCESSFUL','FAILED','REFUNDED','PARTIALLY_REFUNDED','REVERSED','UNMATCHED');
CREATE TYPE "PaymentMethodType" AS ENUM ('MOBILE_MONEY','BANK_CARD','BANK_TRANSFER','CASH_ON_DELIVERY','WALLET');
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE','BASIC','PREMIUM','PROFESSIONAL','BUSINESS','ENTERPRISE');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY','QUARTERLY','ANNUAL');
CREATE TYPE "UserSubscriptionStatus" AS ENUM ('TRIAL','ACTIVE','PAST_DUE','EXPIRED','CANCELLED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','ISSUED','PAID','OVERDUE','VOID');
CREATE TYPE "AdCampaignType" AS ENUM ('BANNER','SPONSORED_PRODUCT','FEATURED_LISTING','SEARCH_PLACEMENT','AGRI_CAMPAIGN');
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','ACTIVE','PAUSED','COMPLETED','REJECTED');
CREATE TYPE "ChannelType" AS ENUM ('HQ','PROVINCE','DISTRICT','SECTOR','CELL','VILLAGE','DIRECT','GROUP','DEPARTMENT');
CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL','HIGH','EMERGENCY');
CREATE TYPE "ExpenseCategory" AS ENUM ('STAFF','MARKETING','HOSTING','AI_API','SMS','COMMUNICATIONS','TRANSPORT_OPERATIONS','SUPPORT','ADMINISTRATION','OTHER');
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING','APPROVED','REJECTED','PAID');

-- ---------------------------------------------------------------------------
-- GEOGRAPHY
-- ---------------------------------------------------------------------------
CREATE TABLE "AdminArea" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level "GeoLevel" NOT NULL,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  "nameLocal" TEXT,
  "parentId" UUID REFERENCES "AdminArea"(id),
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "activatedAt" TIMESTAMPTZ,
  "activatedBy" TEXT,
  "deactivatedAt" TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  population INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "AdminArea"(level);
CREATE INDEX ON "AdminArea"("parentId");
CREATE INDEX ON "AdminArea"("isActive");

-- ---------------------------------------------------------------------------
-- DEPARTMENTS (HQ org chart) -- created before User because RoleAssignment/User reference it
-- ---------------------------------------------------------------------------
CREATE TABLE "Department" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  "headUserId" UUID,
  "parentId" UUID REFERENCES "Department"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE TABLE "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
  status "UserStatus" NOT NULL DEFAULT 'PENDING',
  "nationalId" TEXT UNIQUE,
  "avatarUrl" TEXT,
  "lastLoginAt" TIMESTAMPTZ,
  "refreshTokenHash" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "User"(status);

ALTER TABLE "Department" ADD CONSTRAINT fk_department_head FOREIGN KEY ("headUserId") REFERENCES "User"(id);

CREATE TABLE "RoleAssignment" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  role "UserRole" NOT NULL,
  "geoAreaId" UUID REFERENCES "AdminArea"(id),
  "departmentId" UUID REFERENCES "Department"(id),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "revokedAt" TIMESTAMPTZ,
  UNIQUE("userId", role, "geoAreaId")
);
CREATE INDEX ON "RoleAssignment"("userId");
CREATE INDEX ON "RoleAssignment"(role);
CREATE INDEX ON "RoleAssignment"("geoAreaId");

CREATE TABLE "Cooperative" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  "registrationNumber" TEXT UNIQUE NOT NULL,
  "leaderId" UUID REFERENCES "User"(id),
  "villageAreaId" UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "CooperativeMember" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cooperativeId" UUID NOT NULL REFERENCES "Cooperative"(id) ON DELETE CASCADE,
  "farmerId" UUID NOT NULL REFERENCES "User"(id),
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("cooperativeId","farmerId")
);

-- ---------------------------------------------------------------------------
-- CROPS
-- ---------------------------------------------------------------------------
CREATE TABLE "Crop" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  "localName" TEXT,
  "scientificName" TEXT,
  category "CropCategory" NOT NULL,
  "growingPeriodDays" INTEGER,
  "recommendedRegions" JSONB,
  "soilRequirements" TEXT,
  "rainfallRequirementsMm" TEXT,
  "temperatureMinC" DOUBLE PRECISION,
  "temperatureMaxC" DOUBLE PRECISION,
  "plantingPeriod" TEXT,
  "harvestPeriod" TEXT,
  "expectedYieldPerHaKg" DOUBLE PRECISION,
  "inputRequirements" JSONB,
  "diseaseInfo" JSONB,
  "pestInfo" JSONB,
  "marketInfo" JSONB,
  "productionCostRwfPerHa" DOUBLE PRECISION,
  "estimatedRevenueRwfPerHa" DOUBLE PRECISION,
  "transportConsiderations" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "activatedAt" TIMESTAMPTZ,
  "activatedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Crop"("isActive");

-- ---------------------------------------------------------------------------
-- FARMS
-- ---------------------------------------------------------------------------
CREATE TABLE "Farm" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL REFERENCES "User"(id),
  name TEXT NOT NULL,
  "areaId" UUID NOT NULL REFERENCES "AdminArea"(id),
  "sizeHectares" DOUBLE PRECISION,
  "soilType" TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  "isB2B" BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Farm"("ownerId");
CREATE INDEX ON "Farm"("areaId");

CREATE TABLE "FarmCrop" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL REFERENCES "Farm"(id) ON DELETE CASCADE,
  "cropId" UUID NOT NULL REFERENCES "Crop"(id),
  season TEXT NOT NULL,
  "plantedAreaHa" DOUBLE PRECISION,
  "plantingDate" TIMESTAMPTZ,
  "expectedHarvestDate" TIMESTAMPTZ,
  "actualHarvestDate" TIMESTAMPTZ,
  "expectedYieldKg" DOUBLE PRECISION,
  "actualYieldKg" DOUBLE PRECISION,
  status "FarmCropStatus" NOT NULL DEFAULT 'PLANNED',
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "FarmCrop"("farmId");
CREATE INDEX ON "FarmCrop"("cropId");
CREATE INDEX ON "FarmCrop"(status);

-- ---------------------------------------------------------------------------
-- REVENUE ENGINE (created before marketplace/orders which reference it)
-- ---------------------------------------------------------------------------
CREATE TABLE "CommissionRule" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  "serviceType" "ServiceType" NOT NULL,
  percentage DOUBLE PRECISION,
  "fixedFeeRwf" DOUBLE PRECISION,
  "minimumFeeRwf" DOUBLE PRECISION,
  "maximumFeeRwf" DOUBLE PRECISION,
  payer "CommissionPayer" NOT NULL,
  "geographicScope" JSONB,
  "cropScope" JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  "startDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endDate" TIMESTAMPTZ,
  "createdById" UUID REFERENCES "User"(id),
  "approvedById" UUID REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "CommissionRule"("serviceType", active);

-- ---------------------------------------------------------------------------
-- MARKETPLACE
-- ---------------------------------------------------------------------------
CREATE TABLE "MarketplaceListing" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sellerId" UUID NOT NULL REFERENCES "User"(id),
  "cropId" UUID NOT NULL REFERENCES "Crop"(id),
  "farmCropId" UUID REFERENCES "FarmCrop"(id),
  "areaId" UUID NOT NULL REFERENCES "AdminArea"(id),
  title TEXT NOT NULL,
  description TEXT,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  "pricePerUnit" DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  "qualityGrade" TEXT,
  images JSONB,
  status "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ
);
CREATE INDEX ON "MarketplaceListing"("sellerId");
CREATE INDEX ON "MarketplaceListing"("cropId");
CREATE INDEX ON "MarketplaceListing"("areaId");
CREATE INDEX ON "MarketplaceListing"(status);

-- Transport tables must exist before Order (Order references TransportRequest)
CREATE TABLE "Vehicle" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transporterId" UUID NOT NULL REFERENCES "User"(id),
  type "VehicleType" NOT NULL,
  "plateNumber" TEXT UNIQUE NOT NULL,
  "capacityKg" DOUBLE PRECISION NOT NULL,
  "hasColdChain" BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Vehicle"("transporterId");

CREATE TABLE "TransportFeeConfig" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleType" "VehicleType" NOT NULL,
  "baseFeeRwf" DOUBLE PRECISION NOT NULL,
  "perKmFeeRwf" DOUBLE PRECISION NOT NULL,
  "perKgFeeRwf" DOUBLE PRECISION NOT NULL,
  "loadingFeeRwf" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unloadingFeeRwf" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "waitingFeePerHourRwf" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "coldChainFeeRwf" DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "effectiveTo" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "TransportFeeConfig"("vehicleType", active);

CREATE TABLE "TransportRequest" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" UUID NOT NULL REFERENCES "User"(id),
  "cropId" UUID REFERENCES "Crop"(id),
  "pickupAreaId" UUID NOT NULL REFERENCES "AdminArea"(id),
  "pickupAddress" TEXT,
  "pickupLatitude" DOUBLE PRECISION,
  "pickupLongitude" DOUBLE PRECISION,
  "destinationAreaId" UUID NOT NULL REFERENCES "AdminArea"(id),
  "destinationAddress" TEXT,
  "destinationLatitude" DOUBLE PRECISION,
  "destinationLongitude" DOUBLE PRECISION,
  quantity DOUBLE PRECISION,
  "weightKg" DOUBLE PRECISION NOT NULL,
  "vehicleTypeRequired" "VehicleType",
  "distanceKm" DOUBLE PRECISION,
  "estimatedTravelMinutes" INTEGER,
  "requiresColdChain" BOOLEAN NOT NULL DEFAULT false,
  "specialHandling" JSONB,
  status "TransportRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "TransportRequest"("requesterId");
CREATE INDEX ON "TransportRequest"(status);

CREATE TABLE "TransportQuote" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL REFERENCES "TransportRequest"(id) ON DELETE CASCADE,
  "transporterId" UUID NOT NULL REFERENCES "User"(id),
  "vehicleId" UUID REFERENCES "Vehicle"(id),
  "baseFee" DOUBLE PRECISION NOT NULL,
  "distanceFee" DOUBLE PRECISION NOT NULL,
  "weightFee" DOUBLE PRECISION NOT NULL,
  "vehicleFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "loadingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unloadingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "waitingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "specialHandlingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "coldChainFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "transportCost" DOUBLE PRECISION NOT NULL,
  "commissionRuleId" UUID REFERENCES "CommissionRule"(id),
  "commissionAmount" DOUBLE PRECISION NOT NULL,
  "customerPrice" DOUBLE PRECISION NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "TransportQuote"("requestId");
CREATE INDEX ON "TransportQuote"("transporterId");

-- Payment provider/transaction tables must exist before Order references them
CREATE TABLE "PaymentProvider" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  "supportedMethods" JSONB NOT NULL,
  config JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PaymentMethod" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  "providerId" UUID NOT NULL REFERENCES "PaymentProvider"(id),
  type "PaymentMethodType" NOT NULL,
  "accountRefMasked" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "PaymentMethod"("userId");

CREATE TABLE "PaymentTransaction" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  "providerId" UUID NOT NULL REFERENCES "PaymentProvider"(id),
  "methodId" UUID REFERENCES "PaymentMethod"(id),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  purpose "PaymentPurpose" NOT NULL,
  "sourceId" TEXT,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  status "PaymentTxStatus" NOT NULL DEFAULT 'PENDING',
  "initiatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ,
  "failureReason" TEXT
);
CREATE INDEX ON "PaymentTransaction"("userId");
CREATE INDEX ON "PaymentTransaction"(status);
CREATE INDEX ON "PaymentTransaction"(purpose);

CREATE TABLE "Order" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" UUID NOT NULL REFERENCES "MarketplaceListing"(id),
  "buyerId" UUID NOT NULL REFERENCES "User"(id),
  "sellerId" UUID NOT NULL REFERENCES "User"(id),
  quantity DOUBLE PRECISION NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  "commissionRuleId" UUID REFERENCES "CommissionRule"(id),
  "commissionAmount" DOUBLE PRECISION,
  "sellerReceives" DOUBLE PRECISION,
  "buyerPays" DOUBLE PRECISION,
  status "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "transportRequestId" UUID UNIQUE REFERENCES "TransportRequest"(id),
  "paymentTransactionId" UUID UNIQUE REFERENCES "PaymentTransaction"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ
);
CREATE INDEX ON "Order"("buyerId");
CREATE INDEX ON "Order"("sellerId");
CREATE INDEX ON "Order"(status);

-- ---------------------------------------------------------------------------
-- INPUT SUPPLIERS
-- ---------------------------------------------------------------------------
CREATE TABLE "InputProduct" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplierId" UUID NOT NULL REFERENCES "User"(id),
  category "InputCategory" NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unit',
  "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "relatedCropIds" JSONB,
  images JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "InputProduct"("supplierId");
CREATE INDEX ON "InputProduct"(category);

CREATE TABLE "InputOrder" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL REFERENCES "InputProduct"(id),
  "buyerId" UUID NOT NULL REFERENCES "User"(id),
  quantity DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "commissionRuleId" UUID REFERENCES "CommissionRule"(id),
  "commissionAmount" DOUBLE PRECISION,
  "supplierReceives" DOUBLE PRECISION,
  status "InputOrderStatus" NOT NULL DEFAULT 'PENDING',
  "paymentTransactionId" UUID UNIQUE REFERENCES "PaymentTransaction"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "InputOrder"("buyerId");
CREATE INDEX ON "InputOrder"("productId");

-- ---------------------------------------------------------------------------
-- COMMISSION TRANSACTIONS (settlement ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE "CommissionTransaction" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ruleId" UUID NOT NULL REFERENCES "CommissionRule"(id),
  "orderId" UUID REFERENCES "Order"(id),
  "inputOrderId" UUID REFERENCES "InputOrder"(id),
  "transportQuoteId" UUID REFERENCES "TransportQuote"(id),
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "commissionAmount" DOUBLE PRECISION NOT NULL,
  status "CommissionTxStatus" NOT NULL DEFAULT 'PENDING',
  "settledAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "CommissionTransaction"(status);
CREATE INDEX ON "CommissionTransaction"("ruleId");

-- ---------------------------------------------------------------------------
-- PAYMENTS - remaining tables
-- ---------------------------------------------------------------------------
CREATE TABLE "PaymentAttempt" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transactionId" UUID NOT NULL REFERENCES "PaymentTransaction"(id) ON DELETE CASCADE,
  "attemptNumber" INTEGER NOT NULL,
  status "PaymentTxStatus" NOT NULL,
  "providerResponse" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "PaymentAttempt"("transactionId");

CREATE TABLE "PaymentWebhook" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" UUID NOT NULL REFERENCES "PaymentProvider"(id),
  "eventType" TEXT NOT NULL,
  payload JSONB NOT NULL,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "transactionId" UUID REFERENCES "PaymentTransaction"(id),
  "processedAt" TIMESTAMPTZ,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "PaymentWebhook"("providerId");

CREATE TABLE "PaymentRefund" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transactionId" UUID NOT NULL REFERENCES "PaymentTransaction"(id),
  amount DOUBLE PRECISION NOT NULL,
  reason TEXT,
  status "PaymentTxStatus" NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PaymentReversal" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transactionId" UUID NOT NULL REFERENCES "PaymentTransaction"(id),
  amount DOUBLE PRECISION NOT NULL,
  reason TEXT,
  status "PaymentTxStatus" NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PaymentSettlement" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientId" UUID NOT NULL,
  "periodStart" TIMESTAMPTZ NOT NULL,
  "periodEnd" TIMESTAMPTZ NOT NULL,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "commissionDeducted" DOUBLE PRECISION NOT NULL,
  "feesDeducted" DOUBLE PRECISION NOT NULL,
  "netAmount" DOUBLE PRECISION NOT NULL,
  status "PaymentTxStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "PaymentSettlement"("recipientId");

CREATE TABLE "PaymentReconciliation" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" UUID NOT NULL REFERENCES "PaymentProvider"(id),
  date TIMESTAMPTZ NOT NULL,
  "systemTotal" DOUBLE PRECISION NOT NULL,
  "providerTotal" DOUBLE PRECISION NOT NULL,
  discrepancy DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE "SubscriptionPlan" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tier "SubscriptionTier" NOT NULL,
  "priceRwf" DOUBLE PRECISION NOT NULL,
  "billingCycle" "BillingCycle" NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "SubscriptionFeature" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "planId" UUID NOT NULL REFERENCES "SubscriptionPlan"(id) ON DELETE CASCADE,
  "featureKey" TEXT NOT NULL,
  "featureName" TEXT NOT NULL,
  "limitValue" INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE("planId","featureKey")
);

CREATE TABLE "UserSubscription" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  "planId" UUID NOT NULL REFERENCES "SubscriptionPlan"(id),
  status "UserSubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "startDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endDate" TIMESTAMPTZ,
  "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "UserSubscription"("userId");
CREATE INDEX ON "UserSubscription"(status);

CREATE TABLE "SubscriptionPayment" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userSubscriptionId" UUID NOT NULL REFERENCES "UserSubscription"(id),
  "transactionId" UUID REFERENCES "PaymentTransaction"(id),
  amount DOUBLE PRECISION NOT NULL,
  "periodStart" TIMESTAMPTZ NOT NULL,
  "periodEnd" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "SubscriptionInvoice" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userSubscriptionId" UUID NOT NULL REFERENCES "UserSubscription"(id),
  "invoiceNumber" TEXT UNIQUE NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "dueAt" TIMESTAMPTZ,
  "paidAt" TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- ADVERTISING
-- ---------------------------------------------------------------------------
CREATE TABLE "AdCampaign" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "advertiserId" UUID NOT NULL REFERENCES "User"(id),
  name TEXT NOT NULL,
  type "AdCampaignType" NOT NULL,
  "targetCropIds" JSONB,
  "budgetRwf" DOUBLE PRECISION NOT NULL,
  "spentRwf" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL,
  status "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "AdCampaignTarget" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL REFERENCES "AdCampaign"(id) ON DELETE CASCADE,
  "areaId" UUID NOT NULL REFERENCES "AdminArea"(id),
  UNIQUE("campaignId","areaId")
);

CREATE TABLE "AdPlacement" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL REFERENCES "AdCampaign"(id) ON DELETE CASCADE,
  "placementType" TEXT NOT NULL,
  "listingId" UUID REFERENCES "MarketplaceListing"(id),
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX ON "AdPlacement"("campaignId");

CREATE TABLE "AdMetric" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL REFERENCES "AdCampaign"(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  "spendRwf" DOUBLE PRECISION NOT NULL DEFAULT 0,
  UNIQUE("campaignId", date)
);

-- ---------------------------------------------------------------------------
-- COMMUNICATION
-- ---------------------------------------------------------------------------
CREATE TABLE "Channel" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type "ChannelType" NOT NULL,
  "areaId" UUID REFERENCES "AdminArea"(id),
  "departmentId" UUID REFERENCES "Department"(id),
  name TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Channel"(type);
CREATE INDEX ON "Channel"("areaId");

CREATE TABLE "ChannelMember" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channelId" UUID NOT NULL REFERENCES "Channel"(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"(id),
  "isAdmin" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("channelId","userId")
);

CREATE TABLE "Message" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channelId" UUID NOT NULL REFERENCES "Channel"(id) ON DELETE CASCADE,
  "senderId" UUID NOT NULL REFERENCES "User"(id),
  body TEXT NOT NULL,
  attachments JSONB,
  "sentAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Message"("channelId");

CREATE TABLE "Announcement" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channelId" UUID NOT NULL REFERENCES "Channel"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
  "publishedById" UUID NOT NULL,
  "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ
);
CREATE INDEX ON "Announcement"("channelId");

CREATE TABLE "Notification" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Notification"("userId", read);

-- ---------------------------------------------------------------------------
-- FINANCE / AUDIT
-- ---------------------------------------------------------------------------
CREATE TABLE "Expense" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category "ExpenseCategory" NOT NULL,
  description TEXT NOT NULL,
  "amountRwf" DOUBLE PRECISION NOT NULL,
  "incurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "areaId" UUID REFERENCES "AdminArea"(id),
  status "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
  "createdById" UUID NOT NULL REFERENCES "User"(id),
  "approvedById" UUID REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "Expense"(category);
CREATE INDEX ON "Expense"(status);

CREATE TABLE "AuditLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "User"(id),
  action TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  metadata JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "AuditLog"("userId");
CREATE INDEX ON "AuditLog"("entityType","entityId");
CREATE INDEX ON "AuditLog"("createdAt");

CREATE TABLE "ApiAccessLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "userId" UUID,
  "latencyMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "ApiAccessLog"("createdAt");
CREATE INDEX ON "ApiAccessLog"(path);
