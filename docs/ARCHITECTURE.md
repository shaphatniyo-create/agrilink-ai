# AgriLink AI — Architecture

## 1. Design principles

1. **The database describes all of Rwanda; deployment config decides what's live.** The
   `AdminArea` table stores country → province → district → sector → cell → village as one
   self-referential tree (`GeoLevel` enum + `parentId`), with an `isActive` flag (plus
   `activatedAt`/`activatedBy`) on every node. Nothing in the frontend or backend hard-codes a
   district or sector name. A farm, listing, order, transport request, or report is invalid
   without a link into this tree.
2. **The same pattern activates crops.** `Crop.isActive` gates whether a crop can be planted,
   listed, or ordered — the full crop catalogue (with agronomic + market data) can exist in the
   database well before a crop goes live in the pilot.
3. **Nothing about money is hard-coded.** `CommissionRule` rows (percentage, fixed fee, min/max,
   payer model, geographic/crop scope, effective dates, creator/approver) drive every commission
   calculation in the platform — marketplace, input sales, transport, B2B, financial referrals.
   `TransportFeeConfig` rows drive the transport costing engine the same way. Changing a rate is
   a DAF/Super-Admin operation, never a code deploy.
4. **RBAC is enforced at the API, not the UI.** Every controller route is guarded by
   `JwtAuthGuard` + `RolesGuard` globally; sensitive routes add `@Roles(...)`. Geo-scoped access
   (a District Leader may only touch their district and below) is enforced by `GeoScopeService`/
   `GeoScopeGuard`, which walks the `AdminArea` tree — not by trusting a client-supplied filter.
5. **Aggregation, not duplication.** Village → Cell → Sector → District → Province → National
   rollups (farmer counts, production, revenue) are computed with `parentId`-chain queries at
   read time (`GeoService.stats`, `DafDashboardService`), not maintained as redundant counters.

## 2. Data model (45 tables, `backend/prisma/schema.prisma`)

| Domain | Tables |
|---|---|
| Geography | `AdminArea` |
| Users & org | `User`, `RoleAssignment`, `Department`, `Cooperative`, `CooperativeMember` |
| Crops | `Crop` |
| Farms | `Farm`, `FarmCrop` |
| Marketplace | `MarketplaceListing`, `Order` |
| Input suppliers | `InputProduct`, `InputOrder` |
| Transport | `Vehicle`, `TransportFeeConfig`, `TransportRequest`, `TransportQuote` |
| Revenue engine | `CommissionRule`, `CommissionTransaction` |
| Payments | `PaymentProvider`, `PaymentMethod`, `PaymentTransaction`, `PaymentAttempt`, `PaymentWebhook`, `PaymentRefund`, `PaymentReversal`, `PaymentSettlement`, `PaymentReconciliation` |
| Subscriptions | `SubscriptionPlan`, `SubscriptionFeature`, `UserSubscription`, `SubscriptionPayment`, `SubscriptionInvoice` |
| Advertising | `AdCampaign`, `AdCampaignTarget`, `AdPlacement`, `AdMetric` |
| Communication | `Channel`, `ChannelMember`, `Message`, `Announcement`, `Notification` |
| Finance / audit | `Expense`, `AuditLog`, `ApiAccessLog` |

`backend/prisma/migrations/000_init/migration.sql` is the hand-authored SQL equivalent of the
Prisma schema (needed because this build ran without registry access to the Prisma engine
binaries) — it was executed against a live PostgreSQL 16 instance with zero errors, so the DDL is
proven, not just written.

## 3. RBAC matrix

20 roles (`UserRole` enum): `SUPER_ADMIN, CEO, DAF, CTO, AGRICULTURE_MANAGER, FINANCE_MANAGER`
(HQ / national — see everything), `PROVINCE_LEADER, DISTRICT_LEADER, SECTOR_LEADER, CELL_LEADER,
VILLAGE_LEADER` (geo-scoped to their `AdminArea` and its descendants), and
`FARMER, COOPERATIVE, BUYER, SUPPLIER, TRANSPORTER, AGRICULTURAL_EXPERT, MARKETING_PARTNER,
B2B_CLIENT, CUSTOMER_SUPPORT` (operational roles, generally scoped to their own records).

A user can hold multiple `RoleAssignment` rows (e.g. a District Leader who is also a Farmer),
each independently scoped to a `geoAreaId` and/or `departmentId`. `GeoScopeService.canAccessArea`
walks from the target area up to the root looking for a leader assignment that matches — so a
Sector Leader automatically covers their Cells and Villages without a separate row per descendant.

## 4. Revenue engine

`CommissionRule` supports percentage, fixed fee, min/max caps, and five payer models (seller,
buyer, split, supplier, or a direct fee such as advertiser/subscriber) across nine service types.
`resolveRule()` picks the most specific active rule matching a service type + optional geographic
scope + crop scope (national/generic rules are the fallback). `computeCommission()`
(`backend/src/commissions/commission-engine.ts`) is a pure, unit-testable function turning a
gross amount + rule into `{ commissionAmount, buyerPays, sellerReceives }`.

The same engine backs marketplace orders, input-supplier orders, and transport quotes — see
`backend/prisma/seed.sql` for a fully worked example (a 1,000 kg Irish-potato order: gross
250,000 RWF, 3% seller-paid marketplace commission = 7,500 RWF, seller nets 242,500 RWF; a
transport leg at 52,750 RWF cost + 10% buyer-paid commission = 58,025 RWF customer price; buyer
pays 308,025 RWF total) with the resulting `Order`/`CommissionTransaction` rows actually persisted
and verified.

## 5. Payment abstraction

`PaymentAdapter` (`backend/src/payments/adapters/payment-adapter.interface.ts`) is the contract
every provider implements: `initiate`, `verifySignature`, `parseWebhook`. `MockPaymentAdapter`
gives the whole order→payment→commission→settlement chain something to run against today;
`MtnMomoAdapter` is a real skeleton to fill in once MoMo merchant credentials exist. Adding
Airtel Money or a card processor is: implement the interface, add a `PaymentProvider` row, wire
it into `PaymentsService`'s adapter map — no changes anywhere else in the app.

## 6. Communication hierarchy

`Channel.type` (HQ/PROVINCE/DISTRICT/SECTOR/CELL/VILLAGE/DEPARTMENT/DIRECT/GROUP) plus
`GeoScopeService`/department-membership checks in `CommunicationService.canManageChannel` enforce
the spec's rule directly: a Province Leader can reach their District/Sector/Cell/Village channels,
a Village Leader cannot reach up to Province or HQ, and only HQ roles manage the HQ channel.
Announcements fan out a `Notification` row to every channel member — this is the path for
emergency agricultural alerts.

## 7. Backend module map (`backend/src`)

`auth`, `users`, `geo`, `crops`, `farms`, `marketplace`, `inputs`, `transport`, `payments`,
`commissions`, `subscriptions`, `advertising`, `communication`, `finance` (expenses + DAF
dashboard), `orgchart`, `audit`, plus `common` (RBAC/geo-scope guards & decorators) and `prisma`
(the shared `PrismaService`). Every feature module follows the same shape: `*.service.ts` (Prisma
+ business logic), `*.controller.ts` (routes, `@Roles`), `*.module.ts`.

## 8. Frontend (`frontend/src`)

React + Vite + TypeScript + Tailwind, `react-router` for routing, `zustand` for auth state,
`react-i18next` for EN/FR/RW. `AppLayout` renders a role-adaptive sidebar (DAF finance and crop
activation only for HQ roles, deployment-area activation only for Super Admin). Pages implemented
end-to-end against the real API: `Login`, `Dashboard` (role-adaptive stats), `Marketplace`,
`Farms`, `Transport`, `Communication`, `Subscriptions`, `OrgChart`, `Finance`, `CropsAdmin`,
`GeoAdmin` (the province→village drill-down activation tree). Additional screens (e.g. per-role
deep dashboards, advertising console, input-supplier storefront) extend this same pattern —
service call in `src/api`, page in `src/pages`, route in `App.tsx`.
