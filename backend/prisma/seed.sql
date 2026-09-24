-- ============================================================================
-- AgriLink AI - seed data
-- Real Rwanda country/province/district structure (30 districts, matches the
-- national gazetteer). Sector/cell/village rows below Musanze & Nyagatare are
-- PILOT SAMPLE DATA ONLY (placeholder names) demonstrating the 6-level depth
-- and the ACTIVE DEPLOYMENT AREAS mechanism -- replace/extend with the full
-- NISR administrative gazetteer (416 sectors / 2148 cells / 14837 villages)
-- when moving beyond pilot. All demo user passwords: AgriLink@2026
-- ============================================================================

BEGIN;

CREATE TEMP TABLE ids (key TEXT PRIMARY KEY, id UUID);

-- ---------------------------------------------------------------------------
-- GEOGRAPHY: country -> 5 provinces -> 30 districts (all real)
-- ---------------------------------------------------------------------------
INSERT INTO "AdminArea" (id, level, code, name, "isActive", "activatedAt", "activatedBy")
VALUES (gen_random_uuid(), 'COUNTRY', 'RW', 'Rwanda', true, now(), 'seed');

INSERT INTO "AdminArea" (id, level, code, name, "parentId", "isActive")
SELECT gen_random_uuid(), 'PROVINCE', v.code, v.name, (SELECT id FROM "AdminArea" WHERE code='RW'), false
FROM (VALUES
  ('RW-01','City of Kigali'),
  ('RW-02','Eastern Province'),
  ('RW-03','Northern Province'),
  ('RW-04','Western Province'),
  ('RW-05','Southern Province')
) AS v(code,name);

-- Districts (30) - flag ACTIVE for the two pilot districts only (Musanze, Nyagatare)
INSERT INTO "AdminArea" (id, level, code, name, "parentId", "isActive", "activatedAt", "activatedBy")
SELECT gen_random_uuid(), 'DISTRICT', d.code, d.name,
       (SELECT id FROM "AdminArea" WHERE code = d.province_code),
       d.active,
       CASE WHEN d.active THEN now() ELSE NULL END,
       CASE WHEN d.active THEN 'seed' ELSE NULL END
FROM (VALUES
  ('RW-01-01','Nyarugenge','RW-01', false),
  ('RW-01-02','Gasabo','RW-01', false),
  ('RW-01-03','Kicukiro','RW-01', false),
  ('RW-02-01','Bugesera','RW-02', false),
  ('RW-02-02','Gatsibo','RW-02', false),
  ('RW-02-03','Kayonza','RW-02', false),
  ('RW-02-04','Kirehe','RW-02', false),
  ('RW-02-05','Ngoma','RW-02', false),
  ('RW-02-06','Nyagatare','RW-02', true),
  ('RW-02-07','Rwamagana','RW-02', false),
  ('RW-03-01','Burera','RW-03', false),
  ('RW-03-02','Gakenke','RW-03', false),
  ('RW-03-03','Gicumbi','RW-03', false),
  ('RW-03-04','Musanze','RW-03', true),
  ('RW-03-05','Rulindo','RW-03', false),
  ('RW-04-01','Karongi','RW-04', false),
  ('RW-04-02','Ngororero','RW-04', false),
  ('RW-04-03','Nyabihu','RW-04', false),
  ('RW-04-04','Nyamasheke','RW-04', false),
  ('RW-04-05','Rubavu','RW-04', false),
  ('RW-04-06','Rusizi','RW-04', false),
  ('RW-04-07','Rutsiro','RW-04', false),
  ('RW-05-01','Gisagara','RW-05', false),
  ('RW-05-02','Huye','RW-05', false),
  ('RW-05-03','Kamonyi','RW-05', false),
  ('RW-05-04','Muhanga','RW-05', false),
  ('RW-05-05','Nyamagabe','RW-05', false),
  ('RW-05-06','Nyanza','RW-05', false),
  ('RW-05-07','Nyaruguru','RW-05', false),
  ('RW-05-08','Ruhango','RW-05', false)
) AS d(code, name, province_code, active);

-- Also activate the parent provinces of the pilot districts (Northern, Eastern)
UPDATE "AdminArea" SET "isActive" = true, "activatedAt" = now(), "activatedBy" = 'seed'
WHERE code IN ('RW-03','RW-02');

-- Pilot sectors (sample subset only, ACTIVE) under Musanze
INSERT INTO "AdminArea" (id, level, code, name, "parentId", "isActive", "activatedAt", "activatedBy")
SELECT gen_random_uuid(), 'SECTOR', s.code, s.name, (SELECT id FROM "AdminArea" WHERE code='RW-03-04'), true, now(), 'seed'
FROM (VALUES
  ('RW-03-04-01','Muhoza'),
  ('RW-03-04-02','Kinigi'),
  ('RW-03-04-03','Cyuve'),
  ('RW-03-04-04','Busogo'),
  ('RW-03-04-05','Remera')
) AS s(code, name);

-- Pilot sectors (placeholder, ACTIVE) under Nyagatare
INSERT INTO "AdminArea" (id, level, code, name, "parentId", "isActive", "activatedAt", "activatedBy")
SELECT gen_random_uuid(), 'SECTOR', s.code, s.name, (SELECT id FROM "AdminArea" WHERE code='RW-02-06'), true, now(), 'seed'
FROM (VALUES
  ('RW-02-06-01','Sector Sample A'),
  ('RW-02-06-02','Sector Sample B')
) AS s(code, name);

-- Placeholder cells (2 per pilot sector) - illustrative only
INSERT INTO "AdminArea" (id, level, code, name, "parentId", "isActive", "activatedAt", "activatedBy")
SELECT gen_random_uuid(), 'CELL', c.code, c.name, (SELECT id FROM "AdminArea" WHERE code = c.sector_code), true, now(), 'seed'
FROM (VALUES
  ('RW-03-04-01-A','Cell A','RW-03-04-01'),
  ('RW-03-04-01-B','Cell B','RW-03-04-01'),
  ('RW-03-04-02-A','Cell A','RW-03-04-02'),
  ('RW-02-06-01-A','Cell A','RW-02-06-01')
) AS c(code, name, sector_code);

-- Placeholder villages (2 per pilot cell) - illustrative only
INSERT INTO "AdminArea" (id, level, code, name, "parentId", "isActive", "activatedAt", "activatedBy")
SELECT gen_random_uuid(), 'VILLAGE', v.code, v.name, (SELECT id FROM "AdminArea" WHERE code = v.cell_code), true, now(), 'seed'
FROM (VALUES
  ('RW-03-04-01-A-1','Village 1','RW-03-04-01-A'),
  ('RW-03-04-01-A-2','Village 2','RW-03-04-01-A'),
  ('RW-03-04-01-B-1','Village 1','RW-03-04-01-B'),
  ('RW-03-04-02-A-1','Village 1','RW-03-04-02-A'),
  ('RW-02-06-01-A-1','Village 1','RW-02-06-01-A')
) AS v(code, name, cell_code);

-- ---------------------------------------------------------------------------
-- HQ DEPARTMENTS
-- ---------------------------------------------------------------------------
INSERT INTO "Department" (id, name, code)
VALUES
  (gen_random_uuid(), 'Executive Management', 'EXEC'),
  (gen_random_uuid(), 'Technology', 'TECH'),
  (gen_random_uuid(), 'Administration & Finance (DAF)', 'DAF'),
  (gen_random_uuid(), 'Agricultural Operations', 'AGRI_OPS'),
  (gen_random_uuid(), 'Marketplace', 'MARKETPLACE'),
  (gen_random_uuid(), 'Transport & Logistics', 'TRANSPORT'),
  (gen_random_uuid(), 'AI & Data', 'AI_DATA'),
  (gen_random_uuid(), 'Customer Support', 'SUPPORT'),
  (gen_random_uuid(), 'Compliance & Risk', 'COMPLIANCE'),
  (gen_random_uuid(), 'Regional Operations', 'REGIONAL_OPS');

UPDATE "Department" SET "parentId" = (SELECT id FROM "Department" WHERE code='EXEC')
WHERE code <> 'EXEC';

-- ---------------------------------------------------------------------------
-- DEMO USERS (one per role) - password for all: AgriLink@2026
-- ---------------------------------------------------------------------------
INSERT INTO ids (key, id)
SELECT u.key, gen_random_uuid()
FROM (VALUES
  ('shafati_super_admin'),('helper_admin_1'),
  ('super_admin'),('ceo'),('daf'),('cto'),('agri_manager'),('finance_manager'),
  ('province_leader_north'),('district_leader_musanze'),('sector_leader_muhoza'),
  ('cell_leader_a'),('village_leader_1'),
  ('farmer_1'),('farmer_2'),('cooperative_leader'),('buyer_1'),('supplier_1'),
  ('transporter_1'),('agri_expert_1'),('marketing_partner_1'),('b2b_client_1'),
  ('support_1')
) AS u(key);

-- Founding Super Admin -- the one real person in this seed file. Bootstrap
-- exception to the normal "a different Super Admin must co-sign" rule
-- (there is no other Super Admin yet), so this record is seeded directly
-- ACTIVE with the SUPER_ADMIN role already assigned. Email is pre-verified
-- since it was supplied by the platform owner, not self-registered.
-- Demo password below should be changed after first login in production.
INSERT INTO "User" (id, phone, email, "passwordHash", "firstName", "lastName", "preferredLanguage", status, "emailVerifiedAt")
SELECT id, NULL, 'shaphatniyo@gmail.com', crypt('AgriLink@2026', gen_salt('bf', 10)), 'Shafati', 'Niyonamenye', 'en', 'ACTIVE', now()
FROM ids WHERE key = 'shafati_super_admin';

INSERT INTO "User" (id, phone, email, "passwordHash", "firstName", "lastName", "preferredLanguage", status)
SELECT id, p.phone, p.email, crypt('AgriLink@2026', gen_salt('bf', 10)), p.first, p.last, p.lang, 'ACTIVE'
FROM ids JOIN (VALUES
  ('helper_admin_1','+250780000022','helper.admin@agrilink.rw','Helper','Admin','en'),
  ('super_admin','+250780000001','superadmin@agrilink.rw','Alice','Uwase','en'),
  ('ceo','+250780000002','ceo@agrilink.rw','Jean','Mugisha','en'),
  ('daf','+250780000003','daf@agrilink.rw','Claudine','Ingabire','fr'),
  ('cto','+250780000004','cto@agrilink.rw','Eric','Niyonzima','en'),
  ('agri_manager','+250780000005','agri.ops@agrilink.rw','Beata','Mukamana','rw'),
  ('finance_manager','+250780000006','finance@agrilink.rw','Patrick','Habimana','en'),
  ('province_leader_north','+250780000007','north.leader@agrilink.rw','Vincent','Bizimana','rw'),
  ('district_leader_musanze','+250780000008','musanze.leader@agrilink.rw','Chantal','Mukashema','rw'),
  ('sector_leader_muhoza','+250780000009','muhoza.leader@agrilink.rw','Emmanuel','Ndayisenga','rw'),
  ('cell_leader_a','+250780000010','cella.leader@agrilink.rw','Solange','Uwimana','rw'),
  ('village_leader_1','+250780000011','village1.leader@agrilink.rw','Jean Bosco','Habyarimana','rw'),
  ('farmer_1','+250780000012','farmer1@agrilink.rw','Innocent','Nsengimana','rw'),
  ('farmer_2','+250780000013',NULL,'Immaculee','Nyirahabimana','rw'),
  ('cooperative_leader','+250780000014','coop1@agrilink.rw','Theogene','Rutayisire','rw'),
  ('buyer_1','+250780000015','buyer1@agrilink.rw','Grace','Umutoni','en'),
  ('supplier_1','+250780000016','supplier1@agrilink.rw','Moses','Kagabo','en'),
  ('transporter_1','+250780000017','transporter1@agrilink.rw','David','Sibomana','en'),
  ('agri_expert_1','+250780000018','expert1@agrilink.rw','Dr. Alphonsine','Mukandayisenga','en'),
  ('marketing_partner_1','+250780000019','marketing1@agrilink.rw','Olivier','Nzeyimana','en'),
  ('b2b_client_1','+250780000020','b2b1@agrilink.rw','Kigali Fresh Foods Ltd','(B2B)','en'),
  ('support_1','+250780000021','support1@agrilink.rw','Diane','Uwamahoro','en')
) AS p(key, phone, email, first, last, lang) ON p.key = ids.key;

-- Role assignments (VALUES+JOIN avoids UNION ALL column-type ambiguity with mixed NULLs)
INSERT INTO "RoleAssignment" (id, "userId", role, "geoAreaId", "departmentId", "isPrimary")
SELECT gen_random_uuid(), ids.id, ra.role::"UserRole",
  (SELECT id FROM "AdminArea" WHERE code = ra.geo_code),
  (SELECT id FROM "Department" WHERE code = ra.dept_code),
  true
FROM (VALUES
  ('shafati_super_admin','SUPER_ADMIN',NULL,'EXEC'),
  ('helper_admin_1','HELPER_ADMIN',NULL,'EXEC'),
  ('super_admin','SUPER_ADMIN',NULL,'EXEC'),
  ('ceo','CEO',NULL,'EXEC'),
  ('daf','DAF',NULL,'DAF'),
  ('cto','CTO',NULL,'TECH'),
  ('agri_manager','AGRICULTURE_MANAGER',NULL,'AGRI_OPS'),
  ('finance_manager','FINANCE_MANAGER',NULL,'DAF'),
  ('province_leader_north','PROVINCE_LEADER','RW-03',NULL),
  ('district_leader_musanze','DISTRICT_LEADER','RW-03-04',NULL),
  ('sector_leader_muhoza','SECTOR_LEADER','RW-03-04-01',NULL),
  ('cell_leader_a','CELL_LEADER','RW-03-04-01-A',NULL),
  ('village_leader_1','VILLAGE_LEADER','RW-03-04-01-A-1',NULL),
  ('farmer_1','FARMER','RW-03-04-01-A-1',NULL),
  ('farmer_2','FARMER','RW-03-04-01-B-1',NULL),
  ('cooperative_leader','COOPERATIVE','RW-03-04',NULL),
  ('buyer_1','BUYER','RW-01',NULL),
  ('supplier_1','SUPPLIER','RW-03-04',NULL),
  ('transporter_1','TRANSPORTER',NULL,NULL),
  ('agri_expert_1','AGRICULTURAL_EXPERT',NULL,'AGRI_OPS'),
  ('marketing_partner_1','MARKETING_PARTNER',NULL,NULL),
  ('b2b_client_1','B2B_CLIENT','RW-01',NULL),
  ('support_1','CUSTOMER_SUPPORT',NULL,'SUPPORT')
) AS ra(key, role, geo_code, dept_code)
JOIN ids ON ids.key = ra.key;

-- Demo/seed accounts sign up "pre-verified" so login works immediately
-- without needing to click a real confirmation email in a dev environment.
UPDATE "User" SET "emailVerifiedAt" = now() WHERE email IS NOT NULL AND "emailVerifiedAt" IS NULL;

UPDATE "Department" SET "headUserId" = (SELECT id FROM ids WHERE key='ceo') WHERE code='EXEC';
UPDATE "Department" SET "headUserId" = (SELECT id FROM ids WHERE key='cto') WHERE code='TECH';
UPDATE "Department" SET "headUserId" = (SELECT id FROM ids WHERE key='daf') WHERE code='DAF';
UPDATE "Department" SET "headUserId" = (SELECT id FROM ids WHERE key='agri_manager') WHERE code='AGRI_OPS';

-- ---------------------------------------------------------------------------
-- PILOT CROPS (5) - realistic Rwanda agronomic + market data
-- ---------------------------------------------------------------------------
INSERT INTO "Crop" (id, name, "localName", "scientificName", category, "growingPeriodDays",
  "recommendedRegions", "soilRequirements", "rainfallRequirementsMm", "temperatureMinC", "temperatureMaxC",
  "plantingPeriod", "harvestPeriod", "expectedYieldPerHaKg", "inputRequirements", "diseaseInfo", "pestInfo",
  "marketInfo", "productionCostRwfPerHa", "estimatedRevenueRwfPerHa", "transportConsiderations",
  "isActive", "activatedAt", "activatedBy")
VALUES
(gen_random_uuid(), 'Maize', 'Ibigori', 'Zea mays', 'CEREAL', 120,
  '["Northern Province","Eastern Province"]', 'Well-drained loam, pH 5.5-7.0', '500-800',
  18, 27, 'Season A: Sep-Oct, Season B: Feb-Mar', 'Season A: Jan-Feb, Season B: Jun-Jul', 2500,
  '{"seedKgPerHa":25,"fertilizerNPKKgPerHa":150,"ureaKgPerHa":100}',
  '[{"name":"Maize Lethal Necrosis","symptoms":"yellowing, stunted growth","management":"resistant varieties, rogueing"}, {"name":"Grey Leaf Spot","symptoms":"grey rectangular lesions","management":"crop rotation, fungicide"}]',
  '[{"name":"Fall Armyworm","symptoms":"leaf holes, whorl damage","management":"biopesticides, early detection scouting"}]',
  '{"avgPriceRwfPerKg":280,"demandTrend":"stable","mainBuyers":["millers","livestock feed processors","households"]}',
  450000, 700000, 'Standard dry bulk transport; moisture <13.5% before transport to avoid spoilage',
  true, now(), 'seed'),

(gen_random_uuid(), 'Irish Potato', 'Ikirayi', 'Solanum tuberosum', 'TUBER', 100,
  '["Northern Province","Western Province"]', 'Volcanic loam, well-drained, pH 5.0-6.5', '600-1000',
  10, 22, 'Season A: Sep, Season B: Feb', 'Season A: Dec-Jan, Season B: May-Jun', 18000,
  '{"seedKgPerHa":1500,"fertilizerNPKKgPerHa":400}',
  '[{"name":"Late Blight","symptoms":"dark lesions on leaves and tubers","management":"certified seed, fungicide rotation"}]',
  '[{"name":"Potato Tuber Moth","symptoms":"tunnels in tubers","management":"hilling, proper storage"}]',
  '{"avgPriceRwfPerKg":250,"demandTrend":"rising","mainBuyers":["urban markets","processors","hotels"]}',
  1800000, 3200000, 'Requires ventilated crates, avoid compaction bruising, cool-season transport preferred',
  true, now(), 'seed'),

(gen_random_uuid(), 'Common Bean', 'Ibishyimbo', 'Phaseolus vulgaris', 'LEGUME', 90,
  '["Southern Province","Western Province","Northern Province"]', 'Loam to clay-loam, pH 5.5-7.0', '400-700',
  15, 27, 'Season A: Sep-Oct, Season B: Feb-Mar', 'Season A: Dec-Jan, Season B: May-Jun', 1500,
  '{"seedKgPerHa":60,"fertilizerNPKKgPerHa":100}',
  '[{"name":"Bean Anthracnose","symptoms":"dark sunken lesions on pods","management":"certified seed, crop rotation"}]',
  '[{"name":"Bean Fly","symptoms":"wilting seedlings","management":"seed dressing, early planting"}]',
  '{"avgPriceRwfPerKg":650,"demandTrend":"stable","mainBuyers":["households","exporters","WFP/institutional buyers"]}',
  300000, 900000, 'Dry, bagged transport; keep moisture <15% to prevent mould',
  true, now(), 'seed'),

(gen_random_uuid(), 'Coffee (Arabica)', 'Ikawa', 'Coffea arabica', 'CASH_CROP', 270,
  '["Southern Province","Western Province","Northern Province"]', 'Well-drained volcanic/loam soils, pH 6.0-6.5', '1200-1500',
  15, 24, 'Year-round (perennial); main flowering Sep-Oct', 'Mar-Jun (main harvest)', 900,
  '{"fertilizerNPKKgPerHa":250,"organicMatterTonnesPerHa":5}',
  '[{"name":"Coffee Berry Disease","symptoms":"sunken dark lesions on berries","management":"resistant varieties, fungicide"}, {"name":"Coffee Leaf Rust","symptoms":"orange powdery spots","management":"shade management, fungicide"}]',
  '[{"name":"Coffee Berry Borer","symptoms":"bored holes in cherries","management":"traps, timely picking"}]',
  '{"avgPriceRwfPerKg":1200,"demandTrend":"export-driven, rising","mainBuyers":["washing stations","exporters","specialty roasters"]}',
  1100000, 2400000, 'Cherries transported same-day to washing station to preserve quality; cold chain not required',
  true, now(), 'seed'),

(gen_random_uuid(), 'Cassava', 'Imyumbati', 'Manihot esculenta', 'TUBER', 300,
  '["Eastern Province","Southern Province"]', 'Tolerant of poor soils, pH 5.5-7.5', '800-1200',
  20, 29, 'Sep-Nov (rain-fed)', '10-12 months after planting', 15000,
  '{"stemCuttingsPerHa":10000,"fertilizerNPKKgPerHa":80}',
  '[{"name":"Cassava Mosaic Disease","symptoms":"leaf mottling and distortion","management":"resistant/certified cuttings"}, {"name":"Cassava Brown Streak Disease","symptoms":"brown streaking in roots","management":"clean planting material, rogueing"}]',
  '[{"name":"Cassava Mealybug","symptoms":"stunted shoots, honeydew","management":"biological control (parasitic wasp)"}]',
  '{"avgPriceRwfPerKg":180,"demandTrend":"stable","mainBuyers":["flour processors","households","brewers"]}',
  350000, 1350000, 'Perishable fresh roots - transport within 48h of harvest or process into chips',
  true, now(), 'seed'),

(gen_random_uuid(), 'Tomato', 'Inyanya', 'Solanum lycopersicum', 'VEGETABLE', 120,
  '["Eastern Province","Southern Province"]', 'Well-drained loam, pH 6.0-6.8', '600-800',
  18, 27, 'Season A: Sep-Oct, Season B: Feb-Mar', 'Season A: Dec-Jan, Season B: May-Jun', 40000,
  '{"seedKgPerHa":0.5,"fertilizerNPKKgPerHa":300}',
  '[{"name":"Late Blight","symptoms":"dark patches on leaves, white mold","management":"fungicide, avoid overhead irrigation"}]',
  '[{"name":"Whitefly","symptoms":"yellowing, leaf curl","management":"insecticide, yellow sticky traps"}]',
  '{"avgPriceRwfPerKg":400,"demandTrend":"high","mainBuyers":["markets","supermarkets"]}',
  1200000, 3500000, 'Highly perishable, requires well-ventilated crates',
  true, now(), 'seed'),

(gen_random_uuid(), 'Banana', 'Igitoki', 'Musa spp.', 'FRUIT', 365,
  '["Eastern Province","Western Province"]', 'Deep, well-drained loam, pH 5.5-6.5', '1200-2500',
  15, 30, 'Year-round', 'Year-round', 15000,
  '{"suckersPerHa":1100,"manureTonnesPerHa":10}',
  '[{"name":"Banana Xanthomonas Wilt","symptoms":"wilting, yellowing","management":"remove infected mats, tool hygiene"}]',
  '[{"name":"Banana Weevil","symptoms":"tunnels in corm","management":"clean planting material, trapping"}]',
  '{"avgPriceRwfPerKg":200,"demandTrend":"stable","mainBuyers":["households","markets"]}',
  800000, 2500000, 'Avoid bruising, transport green',
  true, now(), 'seed'),

(gen_random_uuid(), 'Sorghum', 'Amasaka', 'Sorghum bicolor', 'CEREAL', 150,
  '["Eastern Province","Southern Province"]', 'Tolerant to various soils, pH 5.5-8.5', '400-800',
  15, 30, 'Season B: Feb-Mar', 'Season B: Jun-Jul', 2000,
  '{"seedKgPerHa":10,"fertilizerNPKKgPerHa":100}',
  '[{"name":"Sorghum Anthracnose","symptoms":"red/tan lesions","management":"resistant varieties"}]',
  '[{"name":"Stem Borer","symptoms":"deadheart","management":"insecticide, destroy residues"}]',
  '{"avgPriceRwfPerKg":400,"demandTrend":"stable","mainBuyers":["brewers","households"]}',
  250000, 700000, 'Dry bulk transport',
  true, now(), 'seed'),

(gen_random_uuid(), 'Rice', 'Umuceri', 'Oryza sativa', 'CEREAL', 150,
  '["Eastern Province","Southern Province","Western Province"]', 'Heavy clay, poorly drained, pH 5.5-6.5', '1000-2000',
  20, 35, 'Season A: Sep-Oct, Season B: Feb-Mar', 'Season A: Jan-Feb, Season B: Jun-Jul', 5000,
  '{"seedKgPerHa":40,"fertilizerNPKKgPerHa":200,"ureaKgPerHa":100}',
  '[{"name":"Rice Blast","symptoms":"diamond-shaped lesions","management":"fungicide, balanced N"}]',
  '[{"name":"Stem Borer","symptoms":"deadheart, whitehead","management":"insecticide, light traps"}]',
  '{"avgPriceRwfPerKg":800,"demandTrend":"high","mainBuyers":["millers","households"]}',
  600000, 1800000, 'Dry bulk transport, moisture < 14%',
  true, now(), 'seed');

-- ---------------------------------------------------------------------------
-- COMMISSION RULES (configurable revenue engine)
-- ---------------------------------------------------------------------------
INSERT INTO "CommissionRule" (id, name, "serviceType", percentage, "fixedFeeRwf", "minimumFeeRwf", "maximumFeeRwf", payer, active, "createdById", "approvedById")
VALUES
(gen_random_uuid(), 'Marketplace standard commission', 'MARKETPLACE', 3.0, NULL, 500, 100000, 'SELLER', true,
  (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo')),
(gen_random_uuid(), 'Agricultural input sale commission', 'INPUT_SALE', 5.0, NULL, 200, 50000, 'SUPPLIER', true,
  (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo')),
(gen_random_uuid(), 'Transport service commission', 'TRANSPORT', 10.0, NULL, 500, 30000, 'BUYER', true,
  (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo')),
(gen_random_uuid(), 'B2B SaaS referral commission', 'B2B', 8.0, NULL, NULL, NULL, 'SUBSCRIBER', true,
  (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo')),
(gen_random_uuid(), 'Financial service referral fee', 'FINANCIAL_REFERRAL', 2.0, NULL, NULL, NULL, 'SELLER', true,
  (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo'));

-- ---------------------------------------------------------------------------
-- SUBSCRIPTION PLANS + FEATURES
-- ---------------------------------------------------------------------------
INSERT INTO "SubscriptionPlan" (id, code, name, tier, "priceRwf", "billingCycle", description, active)
VALUES
(gen_random_uuid(),'FREE','Free','FREE',0,'MONTHLY','Basic access for every farmer',true),
(gen_random_uuid(),'BASIC','Basic','BASIC',2500,'MONTHLY','Small-scale farmers wanting more AI tools',true),
(gen_random_uuid(),'PREMIUM','Premium','PREMIUM',7500,'MONTHLY','Active sellers and cooperatives',true),
(gen_random_uuid(),'PROFESSIONAL','Professional','PROFESSIONAL',20000,'MONTHLY','Larger farms and agri-professionals',true),
(gen_random_uuid(),'BUSINESS','Business','BUSINESS',75000,'MONTHLY','Cooperatives & agribusinesses with staff accounts',true),
(gen_random_uuid(),'ENTERPRISE','Enterprise','ENTERPRISE',300000,'MONTHLY','Large farms, exporters, NGOs - custom SLAs',true);

INSERT INTO "SubscriptionFeature" (id, "planId", "featureKey", "featureName", "limitValue", enabled)
SELECT gen_random_uuid(), (SELECT id FROM "SubscriptionPlan" WHERE code=f.plan_code), f.key, f.name, f.limit_value, true
FROM (VALUES
  ('FREE','AI_CONSULTATIONS','AI consultations / month',3),
  ('FREE','DISEASE_SCANS','Disease scans / month',3),
  ('FREE','FARM_RECORDS','Farm records',1),
  ('FREE','MARKETPLACE_LISTINGS','Marketplace listings / month',2),
  ('BASIC','AI_CONSULTATIONS','AI consultations / month',15),
  ('BASIC','DISEASE_SCANS','Disease scans / month',15),
  ('BASIC','FARM_RECORDS','Farm records',3),
  ('BASIC','MARKETPLACE_LISTINGS','Marketplace listings / month',10),
  ('PREMIUM','AI_CONSULTATIONS','AI consultations / month',50),
  ('PREMIUM','DISEASE_SCANS','Disease scans / month',50),
  ('PREMIUM','FARM_RECORDS','Farm records',10),
  ('PREMIUM','MARKET_INTELLIGENCE','Market intelligence reports',NULL),
  ('PREMIUM','MARKETPLACE_LISTINGS','Marketplace listings / month',50),
  ('PROFESSIONAL','AI_CONSULTATIONS','AI consultations / month',NULL),
  ('PROFESSIONAL','PRODUCTION_FORECASTING','Production forecasting',NULL),
  ('PROFESSIONAL','FARM_RECORDS','Farm records',NULL),
  ('PROFESSIONAL','ADVANCED_ANALYTICS','Advanced analytics dashboard',NULL),
  ('BUSINESS','STAFF_ACCOUNTS','Staff accounts',10),
  ('BUSINESS','MULTIPLE_FARMS','Multiple farms',NULL),
  ('BUSINESS','ADVANCED_ANALYTICS','Advanced analytics dashboard',NULL),
  ('BUSINESS','PRODUCTION_FORECASTING','Production forecasting',NULL),
  ('ENTERPRISE','STAFF_ACCOUNTS','Staff accounts',NULL),
  ('ENTERPRISE','MULTIPLE_FARMS','Multiple farms',NULL),
  ('ENTERPRISE','DEDICATED_SUPPORT','Dedicated account manager',NULL),
  ('ENTERPRISE','CUSTOM_REPORTS','Custom reporting & API access',NULL)
) AS f(plan_code, key, name, limit_value);

-- ---------------------------------------------------------------------------
-- PAYMENT PROVIDERS (abstraction layer)
-- ---------------------------------------------------------------------------
INSERT INTO "PaymentProvider" (id, code, name, "supportedMethods", "isActive")
VALUES
(gen_random_uuid(),'MTN_MOMO','MTN Mobile Money','["MOBILE_MONEY"]', true),
(gen_random_uuid(),'AIRTEL_MONEY','Airtel Money','["MOBILE_MONEY"]', true),
(gen_random_uuid(),'BANK_CARD','Bank Card (Visa/Mastercard via RSwitch)','["BANK_CARD"]', true),
(gen_random_uuid(),'BANK_TRANSFER','Bank Transfer','["BANK_TRANSFER"]', true),
(gen_random_uuid(),'CASH','Cash on Delivery','["CASH_ON_DELIVERY"]', true),
(gen_random_uuid(),'MOCK','Sandbox / Mock Provider (dev & testing)','["MOBILE_MONEY","BANK_CARD","BANK_TRANSFER"]', true);

-- ---------------------------------------------------------------------------
-- TRANSPORT FEE CONFIG (configurable, per vehicle type)
-- ---------------------------------------------------------------------------
INSERT INTO "TransportFeeConfig" (id, "vehicleType", "baseFeeRwf", "perKmFeeRwf", "perKgFeeRwf", "loadingFeeRwf", "unloadingFeeRwf", "waitingFeePerHourRwf", "coldChainFeeRwf", active)
VALUES
(gen_random_uuid(),'MOTORCYCLE',1000,150,5,500,500,1000,0,true),
(gen_random_uuid(),'TRICYCLE',1500,200,7,700,700,1200,0,true),
(gen_random_uuid(),'PICKUP',3000,350,10,1500,1500,2000,3000,true),
(gen_random_uuid(),'TRUCK_SMALL',5000,500,15,3000,3000,3000,5000,true),
(gen_random_uuid(),'TRUCK_MEDIUM',8000,700,18,5000,5000,4000,8000,true),
(gen_random_uuid(),'TRUCK_LARGE',12000,900,20,8000,8000,5000,12000,true),
(gen_random_uuid(),'REFRIGERATED_TRUCK',15000,1000,25,9000,9000,6000,20000,true);

-- ---------------------------------------------------------------------------
-- SAMPLE FARM -> LISTING -> ORDER -> TRANSPORT -> PAYMENT (proves the full chain)
-- ---------------------------------------------------------------------------
WITH farm_ins AS (
  INSERT INTO "Farm" (id, "ownerId", name, "areaId", "sizeHectares", "soilType", active)
  VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='farmer_1'), 'Nsengimana Family Farm',
    (SELECT id FROM "AdminArea" WHERE code='RW-03-04-01-A-1'), 1.5, 'Volcanic loam', true)
  RETURNING id
)
INSERT INTO ids (key, id) SELECT 'farm_1', id FROM farm_ins;

WITH fc_ins AS (
  INSERT INTO "FarmCrop" (id, "farmId", "cropId", season, "plantedAreaHa", "plantingDate", "expectedHarvestDate", "expectedYieldKg", "actualYieldKg", status)
  VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'),
    (SELECT id FROM "Crop" WHERE name='Irish Potato'), '2026A', 1.0,
    '2026-02-15', '2026-05-25', 18000, 17200, 'HARVESTED')
  RETURNING id
)
INSERT INTO ids (key, id) SELECT 'farmcrop_1', id FROM fc_ins;

WITH listing_ins AS (
  INSERT INTO "MarketplaceListing" (id, "sellerId", "cropId", "farmCropId", "areaId", title, description, quantity, unit, "pricePerUnit", "qualityGrade", status)
  VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='farmer_1'), (SELECT id FROM "Crop" WHERE name='Irish Potato'),
    (SELECT id FROM ids WHERE key='farmcrop_1'), (SELECT id FROM "AdminArea" WHERE code='RW-03-04-01-A-1'),
    'Fresh Irish Potatoes - Grade A', 'Freshly harvested volcanic-soil potatoes, sorted and graded.',
    1000, 'kg', 250, 'A', 'ACTIVE')
  RETURNING id
)
INSERT INTO ids (key, id) SELECT 'listing_1', id FROM listing_ins;

WITH tr_ins AS (
  INSERT INTO "TransportRequest" (id, "requesterId", "cropId", "pickupAreaId", "destinationAreaId", quantity, "weightKg", "vehicleTypeRequired", "distanceKm", "estimatedTravelMinutes", status)
  VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='buyer_1'), (SELECT id FROM "Crop" WHERE name='Irish Potato'),
    (SELECT id FROM "AdminArea" WHERE code='RW-03-04-01-A-1'), (SELECT id FROM "AdminArea" WHERE code='RW-01'),
    1000, 1000, 'PICKUP', 105, 150, 'DELIVERED')
  RETURNING id
)
INSERT INTO ids (key, id) SELECT 'transport_req_1', id FROM tr_ins;

-- Quote = base+distance+weight fees for PICKUP (3000 + 105*350 + 1000*10 = 3000+36750+10000 = 49750) + commission 10% (buyer pays) = 54725
WITH tq_ins AS (
  INSERT INTO "TransportQuote" (id, "requestId", "transporterId", "baseFee", "distanceFee", "weightFee", "vehicleFee", "loadingFee", "unloadingFee", "transportCost", "commissionRuleId", "commissionAmount", "customerPrice", accepted)
  VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='transport_req_1'), (SELECT id FROM ids WHERE key='transporter_1'),
    3000, 36750, 10000, 0, 1500, 1500, 52750,
    (SELECT id FROM "CommissionRule" WHERE name='Transport service commission'), 5275, 58025, true)
  RETURNING id
)
INSERT INTO ids (key, id) SELECT 'transport_quote_1', id FROM tq_ins;

WITH pt_ins AS (
  INSERT INTO "PaymentTransaction" (id, reference, "providerId", "userId", purpose, amount, status, "completedAt")
  VALUES (gen_random_uuid(), 'AGL-DEMO-000001', (SELECT id FROM "PaymentProvider" WHERE code='MOCK'),
    (SELECT id FROM ids WHERE key='buyer_1'), 'MARKETPLACE_ORDER', 308025, 'SUCCESSFUL', now())
  RETURNING id
)
INSERT INTO ids (key, id) SELECT 'payment_1', id FROM pt_ins;

-- Order total 1000kg * 250 = 250,000; marketplace commission 3% seller-paid = 7500; seller receives 242,500;
-- buyer pays product (250,000) + transport customerPrice (58,025) = 308,025
INSERT INTO "Order" (id, "listingId", "buyerId", "sellerId", quantity, "unitPrice", "totalAmount", "commissionRuleId", "commissionAmount", "sellerReceives", "buyerPays", status, "transportRequestId", "paymentTransactionId", "completedAt")
VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='listing_1'), (SELECT id FROM ids WHERE key='buyer_1'), (SELECT id FROM ids WHERE key='farmer_1'),
  1000, 250, 250000, (SELECT id FROM "CommissionRule" WHERE name='Marketplace standard commission'), 7500, 242500, 308025,
  'COMPLETED', (SELECT id FROM ids WHERE key='transport_req_1'), (SELECT id FROM ids WHERE key='payment_1'), now());

UPDATE "MarketplaceListing" SET status='SOLD' WHERE id = (SELECT id FROM ids WHERE key='listing_1');

INSERT INTO "CommissionTransaction" (id, "ruleId", "orderId", "grossAmount", "commissionAmount", status, "settledAt")
VALUES (gen_random_uuid(), (SELECT id FROM "CommissionRule" WHERE name='Marketplace standard commission'),
  (SELECT id FROM "Order" LIMIT 1), 250000, 7500, 'SETTLED', now());

INSERT INTO "CommissionTransaction" (id, "ruleId", "transportQuoteId", "grossAmount", "commissionAmount", status, "settledAt")
VALUES (gen_random_uuid(), (SELECT id FROM "CommissionRule" WHERE name='Transport service commission'),
  (SELECT id FROM ids WHERE key='transport_quote_1'), 52750, 5275, 'SETTLED', now());

-- ---------------------------------------------------------------------------
-- SAMPLE EXPENSE + HQ COMMUNICATION CHANNEL
-- ---------------------------------------------------------------------------
INSERT INTO "Expense" (id, category, description, "amountRwf", status, "createdById", "approvedById")
VALUES
  (gen_random_uuid(), 'HOSTING', 'Cloud infrastructure - August 2026', 1250000, 'PAID', (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo')),
  (gen_random_uuid(), 'SMS', 'Bulk SMS gateway - farmer alerts', 380000, 'PAID', (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo')),
  (gen_random_uuid(), 'AI_API', 'AI model inference costs', 920000, 'APPROVED', (SELECT id FROM ids WHERE key='daf'), (SELECT id FROM ids WHERE key='ceo'));

WITH ch_ins AS (
  INSERT INTO "Channel" (id, type, name, "createdById")
  VALUES (gen_random_uuid(), 'HQ', 'AgriLink HQ Announcements', (SELECT id::text FROM ids WHERE key='super_admin'))
  RETURNING id
)
INSERT INTO ids (key, id) SELECT 'channel_hq', id FROM ch_ins;

INSERT INTO "ChannelMember" (id, "channelId", "userId", "isAdmin")
SELECT gen_random_uuid(), (SELECT id FROM ids WHERE key='channel_hq'), id, true FROM ids WHERE key='super_admin'
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM ids WHERE key='channel_hq'), id, false FROM ids WHERE key IN ('province_leader_north','district_leader_musanze');

INSERT INTO "Announcement" (id, "channelId", title, body, priority, "publishedById")
VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='channel_hq'), 'Welcome to AgriLink AI pilot',
  'Musanze and Nyagatare districts are now live on the platform for the 2026 pilot season.', 'HIGH',
  (SELECT id FROM ids WHERE key='super_admin'));

-- ---------------------------------------------------------------------------
-- AI ADVISORY / GIS / FARM FINANCE DEMO DATA
-- ---------------------------------------------------------------------------

-- GIS: a simple boundary polygon around Nsengimana Family Farm (farm_1),
-- plus one soil zone -- enough to exercise the map/zone UI with real data.
INSERT INTO "FarmZone" (id, "farmId", name, "zoneType", boundary, notes)
VALUES
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), 'Farm boundary', 'BOUNDARY',
   '[{"lat":-1.4995,"lng":29.6335},{"lat":-1.4990,"lng":29.6345},{"lat":-1.5002,"lng":29.6350},{"lat":-1.5008,"lng":29.6338}]',
   'Approximate boundary, GPS-walked at planting'),
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), 'Volcanic loam block (north)', 'SOIL',
   '[{"lat":-1.4995,"lng":29.6335},{"lat":-1.4990,"lng":29.6345},{"lat":-1.4998,"lng":29.6348}]',
   'Best-draining section, reserved for potato');

-- Farm bookkeeping for farm_1 -- a season's worth of expenses/income so the
-- financial-advisor dashboard has something real to summarize on first login.
INSERT INTO "FarmExpense" (id, "farmId", category, amount, note, "incurredAt", "createdById")
VALUES
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), 'Seeds', 180000, 'Certified potato seed, 1.0 ha', '2026-02-10', (SELECT id FROM ids WHERE key='farmer_1')),
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), 'Fertilizer', 220000, 'NPK top-dressing', '2026-03-01', (SELECT id FROM ids WHERE key='farmer_1')),
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), 'Labor', 95000, 'Weeding + hilling crew', '2026-03-20', (SELECT id FROM ids WHERE key='farmer_1'));

INSERT INTO "FarmIncome" (id, "farmId", source, amount, note, "receivedAt", "createdById")
VALUES
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), 'Marketplace sale', 250000, 'Irish Potato listing part-sale', '2026-05-28', (SELECT id FROM ids WHERE key='farmer_1'));

-- AI Plant Doctor: one resolved demo diagnosis for farm_1, grounded in the
-- real Irish Potato disease data seeded on the Crop row above (Late Blight).
INSERT INTO "AiDiagnosis" (id, "userId", "farmId", "cropId", "engineType", "inputText", findings, recommendation, confidence)
VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='farmer_1'), (SELECT id FROM ids WHERE key='farm_1'),
  (SELECT id FROM "Crop" WHERE name='Irish Potato'), 'PLANT_DOCTOR',
  'dark lesions on leaves, some spreading to tubers, worse after the rains',
  '{"matches":[{"source":"disease","name":"Late Blight","score":0.86,"symptoms":"dark lesions on leaves and tubers","management":"certified seed, fungicide rotation"}]}',
  'Likely Late Blight. Apply a protectant fungicide rotation and improve field drainage; use certified seed next season to reduce inoculum.',
  0.86);

-- Weather advisories for the two pilot districts.
INSERT INTO "WeatherAlert" (id, "geoAreaId", "alertType", severity, message, recommendation, "startsAt", "endsAt", "createdById")
VALUES
  (gen_random_uuid(), (SELECT id FROM "AdminArea" WHERE code='RW-03-04'), 'RAIN', 'WATCH',
   'Heavy rainfall expected over Musanze district for the next 3 days.',
   'Delay fertilizer top-dressing until rainfall subsides to avoid nutrient runoff; check field drainage in low-lying plots.',
   now(), now() + interval '3 days', (SELECT id FROM ids WHERE key='agri_manager')),
  (gen_random_uuid(), (SELECT id FROM "AdminArea" WHERE code='RW-02-06'), 'DROUGHT', 'ADVISORY',
   'Below-average rainfall recorded across Nyagatare district this month.',
   'Prioritize irrigation for water-sensitive stages (flowering/grain-fill) and consider drought-tolerant maize varieties for the next planting.',
   now(), now() + interval '14 days', (SELECT id FROM ids WHERE key='agri_manager'));

-- IoT field sensor demo data for farm_1 (Nsengimana Family Farm): an ESP32 +
-- NPK probe + DC pump device with a short reading history, so the farmer
-- dashboard has something real to show on first login. The apiKeyHash below
-- is a placeholder, NOT a usable credential -- register a real device from
-- the dashboard ("Add sensor") to get a real, working device secret; this
-- seeded row exists only so its historical readings/alert render.
INSERT INTO "IotDevice" (id, "farmId", "deviceCode", "apiKeyHash", label, status, "lastSeenAt", "createdById")
VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), 'IOT-DEMO0001',
  '$2a$10$SEEDPLACEHOLDERNOTAREALHASHXXXXXXXXXXXXXXXXXXXXXXXXXX', 'North field probe', 'ACTIVE',
  now() - interval '25 minutes', (SELECT id FROM ids WHERE key='farmer_1'));
INSERT INTO ids (key, id) SELECT 'iot_device_1', id FROM "IotDevice" WHERE "deviceCode" = 'IOT-DEMO0001';

INSERT INTO "SoilReading" (id, "deviceId", "farmId", "moisturePct", "temperatureC", ph, "nitrogenPpm", "phosphorusPpm", "potassiumPpm", "pumpState", "recordedAt")
VALUES
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='iot_device_1'), (SELECT id FROM ids WHERE key='farm_1'), 42, 21.5, 6.2, 38, 22, 30, 'OFF', now() - interval '3 days'),
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='iot_device_1'), (SELECT id FROM ids WHERE key='farm_1'), 35, 22.8, 6.1, 33, 19, 26, 'OFF', now() - interval '2 days'),
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='iot_device_1'), (SELECT id FROM ids WHERE key='farm_1'), 27, 24.1, 6.0, 29, 17, 24, 'ON', now() - interval '1 days'),
  (gen_random_uuid(), (SELECT id FROM ids WHERE key='iot_device_1'), (SELECT id FROM ids WHERE key='farm_1'), 18, 25.3, 5.9, 26, 15, 21, 'ON', now() - interval '25 minutes');

-- Matches the last reading above (moisturePct=18 < 20 threshold) -- open,
-- exactly as IotService#evaluateThresholds would have created it on ingest.
INSERT INTO "SensorAlert" (id, "farmId", "deviceId", "alertType", severity, message, recommendation, "createdAt")
VALUES (gen_random_uuid(), (SELECT id FROM ids WHERE key='farm_1'), (SELECT id FROM ids WHERE key='iot_device_1'),
  'LOW_MOISTURE', 'WARNING', 'Soil moisture is critically low.',
  'Irrigate soon if the crop is in a moisture-sensitive growth stage.', now() - interval '25 minutes');

COMMIT;
