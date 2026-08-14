-- Belt and braces for a check-then-act invariant that lib/services/locks.ts
-- currently holds up on its own with SELECT … FOR UPDATE.
--
-- The lock works, but it only protects the paths that remember to take it.
-- This index makes the database itself refuse the bad write, from any path,
-- including a script or a future endpoint whose author never read locks.ts.
--
-- It is PARTIAL, which is why it could not live in schema.prisma: Prisma cannot
-- express `WHERE`. That is also why it could not exist while production deployed
-- with `prisma db push` — push makes the database match the schema and would
-- have dropped it silently, precisely when it was still believed to be there.
-- It is safe only now that production applies migrations.
--
-- IF THIS FAILS TO CREATE, the data already violates the rule the application
-- believes it enforces. Do not force it through: find the offending rows first
-- (the query is in docs/migrate-deploy-runbook.md).

-- One open time entry per employee. A second clock-in while one is still open
-- double-counts paid hours (clockService.ts: "Already clocked in").
CREATE UNIQUE INDEX "TimeEntry_employeeId_open_key"
  ON "TimeEntry" ("employeeId")
  WHERE "clockOut" IS NULL;

-- NOTE: the matching index for shifts — one live shift per employee per date —
-- is deliberately NOT here. That rule is being removed, not hardened: split
-- shifts (lunch 11:00–14:00 and dinner 18:00–23:00 for the same chef) are
-- normal in hospitality, and the constraint would make them permanently
-- impossible. The rota rule becomes "no OVERLAPPING shifts", which is a range
-- predicate a unique index cannot express. `lockEmployee` stays as the
-- serialization point for it.
