-- When a scheduled seat reduction becomes effective: the end of the billing
-- period it was requested in.
--
-- Deliberately resolved at READ time (see lib/services/seats.ts) rather than by
-- a cron job or a webhook handler. A missed Stripe event or a failed cron would
-- otherwise leave an org holding seats it had stopped paying for — or worse,
-- blocked from adding staff to seats it still owns. Comparing against NOW() in
-- the same locked query that enforces the cap cannot drift.
ALTER TABLE "Organization" ADD COLUMN "pendingSeatsEffectiveAt" TIMESTAMP(3);

-- Any reduction scheduled before this column existed (there are none in
-- practice, but be explicit) applies immediately rather than never.
UPDATE "Organization"
SET "pendingSeatsEffectiveAt" = NOW()
WHERE "pendingSeats" IS NOT NULL AND "pendingSeatsEffectiveAt" IS NULL;
