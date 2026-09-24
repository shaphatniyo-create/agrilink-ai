# Roadmap: pilot → national scale

This build is intentionally structured so scaling from "2 pilot districts, 5 crops" to "all 30
districts, all crops, full national gazetteer" requires **data changes and configuration, not
architecture changes.**

## What scaling up actually touches

| To do this... | ...touch this, and nothing else |
|---|---|
| Activate a new district/sector/cell/village | `PATCH /geo/:id/active` (Super Admin) — `AdminArea` row already exists or is inserted once via the NISR gazetteer import |
| Add a new pilot crop | `POST /crops` then `PATCH /crops/:id/active` |
| Change a commission rate | `POST/PATCH /commissions/rules` — versioned, approvable, geo/crop-scoped |
| Change a transport fee | `POST /transport/fee-config` |
| Add a payment provider (Airtel Money, a card processor) | implement `PaymentAdapter`, insert a `PaymentProvider` row, register it in `PaymentsService` |
| Add a subscription tier or feature | `POST /subscriptions/plans` / `.../plans/:id/features` |
| Stand up a new HQ department | `Department` row + `RoleAssignment`s |

## Suggested phased plan

1. **Pilot (this build's seed data)**: Musanze + Nyagatare districts, 5 crops, ~20 seeded roles,
   mock payment provider, core marketplace/transport/finance flows exercised end-to-end.
2. **Provincial rollout**: activate remaining districts within Northern and Eastern Province;
   import their real sectors/cells/villages from the NISR gazetteer (a data load against the
   existing `AdminArea` schema); recruit Province/District/Sector/Cell/Village leaders via
   `POST /users/:id/roles`.
3. **National rollout**: same mechanism repeated for the remaining 3 provinces; at this point all
   14,837 villages exist in the database, most `isActive=false` until each village's Village
   Leader and first farmers are onboarded.
4. **Live payments**: replace `MockPaymentAdapter` with real MTN MoMo / Airtel Money / bank-card
   adapters (skeletons already in `backend/src/payments/adapters/`); wire reconciliation against
   real settlement files via `PaymentsService.reconcile`.
5. **B2B/Enterprise**: the `Cooperative`, `isB2B` farm flag, `BUSINESS`/`ENTERPRISE` subscription
   tiers, and multi-staff-account features already exist in the schema — building the dedicated
   B2B console UI is additive, not a data-model change.
6. **AI Farm Assistant**: `SubscriptionFeature.featureKey` already includes `AI_CONSULTATIONS` /
   `DISEASE_SCANS` as gated, plan-limited features (see `SubscriptionsService.hasFeature`) — the
   AI service itself (model inference, disease image classification) is the next module to build
   behind that same gate, tracked as an `AI_API` expense category in the DAF dashboard already.

## Known gaps to close before a real production launch

- Real payment provider integration (see above) — currently mock-only.
- Full NISR administrative gazetteer import (this build ships real provinces/districts, but
  placeholder sector/cell/village names for the two pilot districts only — see
  `backend/prisma/seed.sql`'s header comment).
- npm dependency install + TypeScript build + automated tests, none of which could run in the
  sandboxed environment this was built in (no package-registry network access) — see the
  "A note on how this was built" section of the root `README.md`.
- Payment gateway fee tracking and partner-payout ledger (the DAF dashboard's Net Operating
  Result formula has explicit, commented placeholders for these — `paymentFees`/
  `commissionPayable` in `backend/src/finance/daf-dashboard.service.ts`).
- Security hardening pass (secret rotation, rate-limit tuning, penetration test) before handling
  real money.
