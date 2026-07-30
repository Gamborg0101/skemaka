-- Per-shift draft/publish state (Planday-style). Null = draft placeholder only
-- managers see; set when the shift is rolled out (sent) to the employee.
-- Replaces the week-level publish semantics where any edit reverted the whole
-- Schedule to draft.
ALTER TABLE "Shift" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Backfill: shifts on already-published weeks were sent to staff.
UPDATE "Shift" s SET "publishedAt" = sch."publishedAt"
FROM "Schedule" sch
WHERE s."scheduleId" = sch.id AND sch."publishedAt" IS NOT NULL;
