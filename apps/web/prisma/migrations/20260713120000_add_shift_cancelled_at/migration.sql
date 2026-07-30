-- Manager-cancelled shifts keep their row (visible record for manager +
-- employee) but are excluded from costs, publishing, and conflict checks.
ALTER TABLE "Shift" ADD COLUMN "cancelledAt" TIMESTAMP(3);
