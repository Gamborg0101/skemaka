-- Seat-licensed billing.
--
-- `seats` is the Stripe subscription quantity AND the cap on active employees.
-- Minimum 5, because the €19/month floor already covers 5 seats — an org can
-- never hold fewer. Not enforced while TRIALING: a trial org adds employees
-- freely and buys seats for whatever it has at checkout.
--
-- `pendingSeats` holds a scheduled REDUCTION. Decreases never apply mid-cycle:
-- the org keeps and pays for `seats` until the billing period rolls over, then
-- pendingSeats replaces it. Increases apply immediately (Stripe prorates) and
-- never touch this column. NULL = no scheduled change.
ALTER TABLE "Organization" ADD COLUMN "seats" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Organization" ADD COLUMN "pendingSeats" INTEGER;

-- Existing orgs: give every org enough seats to cover the employees it already
-- has, so nothing is retroactively over-limit on release day. Orgs with 5 or
-- fewer active employees stay at the 5-seat minimum.
UPDATE "Organization" o
SET "seats" = GREATEST(
  5,
  (SELECT COUNT(*) FROM "Employee" e
    WHERE e."organizationId" = o."id" AND e."isActive" = true)
);
