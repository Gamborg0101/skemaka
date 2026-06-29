-- Billing enforcement: trial expiry, PAST_DUE grace anchor, webhook ordering +
-- idempotency ledger.

-- AlterTable: add the billing timestamp columns.
ALTER TABLE "Organization" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "pastDueSince" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "stripeEventAt" TIMESTAMP(3);

-- Backfill: existing TRIALING orgs (production users today) have no trial end.
-- Give them a fresh 14-day window from the deploy so nobody is blocked instantly.
-- (Alternative policy: "createdAt" + 14 days — would expire long-running trials
-- immediately. We chose deploy + 14 days for launch goodwill.)
UPDATE "Organization"
SET "trialEndsAt" = NOW() + INTERVAL '14 days'
WHERE "subscriptionStatus" = 'TRIALING' AND "trialEndsAt" IS NULL;

-- Backfill: any org already PAST_DUE gets its grace clock anchored to now.
UPDATE "Organization"
SET "pastDueSince" = NOW()
WHERE "subscriptionStatus" = 'PAST_DUE' AND "pastDueSince" IS NULL;

-- CreateTable: Stripe webhook idempotency ledger.
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessedStripeEvent_createdAt_idx" ON "ProcessedStripeEvent"("createdAt");
