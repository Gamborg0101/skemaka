# Moving production to `prisma migrate deploy`

> ⚠️ **STATUS: PREPARED, NOT YET EXECUTED.** Migrations are applied by hand
> (§2). §3 (baselining) is a **one-time manual step that has not been done**.
> Until it is, production still gets its schema from `prisma db push`.
>
> **There is no automatic migration on deploy, and cannot be one as configured.**
> It was tried on 2026-08-14 and the production build failed instantly:
> `DATABASE_URL` is marked **Sensitive** in Vercel, and sensitive variables are
> runtime-only — the build container never sees them. A step that skipped when
> the variable was missing would always skip while appearing to migrate on every
> deploy, which is worse than not having it. Production was unaffected (Vercel
> keeps serving the last good deployment when a build fails).
>
> If automatic migration is wanted later, the workable route is a GitHub Actions
> job on push to `main` holding the connection string as a repository secret —
> not the Vercel build.

## 0. Why bother

Production applies schema changes with `prisma db push`. Push makes the database
match `schema.prisma` — so anything Prisma cannot express is **silently dropped**
on the next deploy. That is why the two check-then-act invariants are held up by
`SELECT … FOR UPDATE` in `lib/services/locks.ts` rather than partial unique
indexes: an index would have been deleted without a word, precisely when it was
still believed to be enforcing something.

`migrate deploy` applies an ordered list of migration files instead. It never
invents changes, it refuses to run when the database has drifted, and it makes
hand-written SQL (partial indexes, constraints, triggers) survivable.

## 1. What is already in place

| Piece | State |
|---|---|
| 21 migration files in `apps/web/prisma/migrations/` | ✅ replay from empty with no drift (CI proves this on every PR) |
| CI runs `prisma migrate deploy` | ✅ already — see `.github/workflows/ci.yml` |
| `scripts/migrate-on-deploy.mjs` | ✅ merged — run by hand, prints the target host before acting |
| `npm run db:status` / `db:deploy` | ✅ added |
| Production database baselined | ❌ **this is the step below** |

## 2. Applying a migration

There is no automatic step. From `apps/web`, naming the database explicitly:

```bash
DATABASE_URL='<connection string>' npm run db:status   # read-only, look first
DATABASE_URL='<connection string>' npm run db:deploy   # then apply
```

`db:deploy` prints the target **host** before doing anything — check it is the
one you meant. Against production this will fail until §3 has been done.

## 3. Baseline production — the one-time step

Production's tables were created by `db push`, so its
`_prisma_migrations` table is empty or missing. Running `migrate deploy` against
it as-is would try to replay `20260514092725_init` on a database that already has
every table, and fail on the first `CREATE TABLE`.

Baselining means recording the existing migrations as already-applied, without
running their SQL.

```bash
cd apps/web

# 1. Point at PRODUCTION. Use a fresh shell so this cannot leak into later work.
export DATABASE_URL='<prod connection string from Vercel>'

# 2. Look before you touch anything. This is read-only.
npx prisma migrate status
```

`migrate status` tells you which case you are in:

- **"No migration found in the database"** → baseline everything (step 3).
- **"Database schema is up to date"** → already baselined; skip to §3.
- **"Drift detected"** → STOP. The database has something the migrations do not
  describe. Resolve that first (§4) — do not baseline over it.

```bash
# 3. Mark every EXISTING migration as applied, running none of them.
#    The newest one (the partial index) is deliberately NOT in this list: it has
#    never been applied to production and must actually run.
for m in \
  20260514092725_init \
  20260514120945_add_employment_type_contract_hours_job_roles \
  20260515000000_add_shift_templates \
  20260515165933_add_org_currency \
  20260515182715_add_isactive_and_status_indexes \
  20260515191633_publish_timeoff_payroll \
  20260516075334_add_org_settings \
  20260516110904_add_bug_reports \
  20260610143859_add_employee_wage_base \
  20260613120000_billing_enforcement \
  20260628120000_sms_opt_out \
  20260707080000_sync_schema_drift \
  20260709000000_add_push_subscriptions \
  20260712120000_add_employee_locale \
  20260713120000_add_shift_cancelled_at \
  20260715120000_add_shift_offers \
  20260716120000_shift_published_at \
  20260717090000_org_is_demo \
  20260730210000_org_seats \
  20260730230000_pending_seats_effective_at
do
  npx prisma migrate resolve --applied "$m"
done

# 4. Confirm exactly one migration is now pending.
npx prisma migrate status
```

You want: *"1 migration has not yet been applied"* —
`20260813140000_add_partial_unique_indexes`.

**Before applying it, check the data can satisfy it.** The index enforces one
open time entry per employee; if two already exist, creation fails.

```sql
-- Must return zero rows.
SELECT "employeeId", count(*)
FROM "TimeEntry"
WHERE "clockOut" IS NULL
GROUP BY "employeeId"
HAVING count(*) > 1;
```

If it returns rows, someone is clocked in twice — the exact bug the index
prevents. Close the stale entries (keep the newest `clockIn`) before continuing;
do not drop the index to make the error go away.

```bash
# 5. Apply it.
npx prisma migrate deploy
```

**Take a restore branch first** (`docs/restore-runbook.md`). It costs a minute
and the history window is only 6 hours.

## 4. After baselining

Migrations are applied with `npm run db:deploy` (§2) whenever a new one lands.
Nothing happens automatically.

- [ ] Remove `db push` from any habit or note that still recommends it for
      production. `npm run db:push` stays for local/dev use.
- [ ] Update the CLAUDE.md line that says production uses `db push`.
- [ ] Consider adding back the *shift* invariant — but note it **cannot** be a
      unique index. The rule is "no overlapping shifts" (split shifts are legal),
      which is a range predicate. An EXCLUDE constraint with `btree_gist` could
      express it; `lockEmployee` covers it today.

## 5. When it goes wrong

**`migrate deploy` fails.** Nothing has been applied — Postgres runs DDL
transactionally. Read the error: it names the migration and the failing
statement.

**"Drift detected".** The database has something the migrations do not describe —
usually a `db push` that happened after the last migration was written. Either
write a migration describing the difference, or `prisma migrate diff` it:

```bash
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > /tmp/drift.sql
```

Read `/tmp/drift.sql` before doing anything with it.

**A migration half-applied.** Postgres runs DDL transactionally, so a failed
migration rolls back — but Prisma marks it failed. Fix the cause, then
`npx prisma migrate resolve --rolled-back "<name>"` and redeploy.

**Emergency escape.** `db push` still works and will make the database match the
schema. It will also drop the partial index without saying so. Use it only to
restore service, and re-baseline afterwards.
