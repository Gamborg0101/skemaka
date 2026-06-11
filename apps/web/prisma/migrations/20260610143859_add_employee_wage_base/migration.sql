-- Add wage base columns to Employee table.
-- wageBaseAmount  stores the wage as entered by the manager (4 decimal places for precision).
-- wageBaseCurrency stores the currency code active at the time of entry.
-- Together these form an immutable canonical base so that currency conversions can always
-- be recomputed from the original value, preventing compounding rounding drift.

ALTER TABLE "Employee"
  ADD COLUMN "wageBaseAmount"   DECIMAL(12, 4),
  ADD COLUMN "wageBaseCurrency" TEXT;

-- Backfill existing rows: treat the current hourlyWage as the base amount and
-- use the employee's organization currency as the base currency.
UPDATE "Employee" e
SET
  "wageBaseAmount"   = e."hourlyWage",
  "wageBaseCurrency" = o."currency"
FROM "Organization" o
WHERE e."organizationId" = o."id"
  AND e."wageBaseAmount" IS NULL;
