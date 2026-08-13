# Database restore runbook (Neon)

> ✅ **STATUS: DRILLED 2026-08-13 against the production Neon project.**
> A branch was restored to a past point in time and **returned an organization
> that had been deleted from production ~20 minutes earlier** — so this recovers
> deleted data, not just a copy of the current state. Whole thing took about
> **3 minutes**, console-only, no `psql` needed.
>
> One number is still unknown: the **retention window** (see §1). Everything
> else below is confirmed.

## 0. What this is for

The realistic disasters, in rough order of likelihood:

| Scenario | Blast radius | Right tool |
|---|---|---|
| Deleted the wrong org / employee via the UI | One org's rows | §4 targeted restore |
| A bad migration or `db push` dropped a column | Whole schema | §3 full PITR branch |
| A script or seed ran against prod by mistake | Many tables | §3 full PITR branch |
| Neon region incident | Everything | Neon status page; PITR won't help |

**The bias: never restore in place.** Neon PITR creates a *branch* — a separate
endpoint with its own connection string. Read from the branch, copy what you
need into prod, and leave production running. Restoring over prod turns a
recoverable mistake into an outage.

## 1. Prerequisites — confirm BEFORE you need them

- [ ] ⚠️ **STILL UNKNOWN: the PITR retention window.** Free tier historically
      gave ~24 h; paid plans give longer. **If the incident is older than the
      window, none of this works** — the single most important number here.
      Find it by opening the branch-creation dialog, choosing "from a past
      point in time", and seeing how far back the date picker will go.
- [x] Parent branch is named **`production`**. Neon calls the restore a "child
      branch"; creating one does not touch the parent.
- [x] Access: Neon console login is enough — the console's **SQL Editor** can
      query the restored branch directly, so no `psql` install and no handling
      of a connection string.

Production schema is applied with `prisma db push`, not `migrate deploy`
(see `Before launch.md`), so the branch you restore reflects whatever shape prod
was in at that timestamp — not necessarily any migration in `prisma/migrations/`.

## 2. Decide the target timestamp first

Before touching anything, establish **the last moment the data was known good**,
in UTC. Sources, in order of reliability:

1. Vercel logs — find the offending request by `requestId`; its timestamp is
   the upper bound.
2. `SuperAdminAudit` rows (`/platform`), if the damage came through an admin action.
3. The user's report ("it was there this morning") — treat as a hint, not a fact.

Pick a timestamp **a few seconds before** the bad write. Restoring to the exact
instant risks including it.

## 3. Full restore to a branch (the drill)

In the Neon console: **Branches → Create child branch**. Then:

- **Name:** `restore-YYYYMMDD-HHMM`
- **Auto-delete: After 1 day** — cleanup handles itself, so §5's "delete the
  branch" step is only needed if you pick a longer retention here.
- **Parent branch:** `production`
- **Radio: "Branch data and schema from a past point in time"** — NOT the
  default "Branch data and schema", which clones the current state and proves
  nothing about recovery. Set the timestamp from §2.

Verify it before trusting it. The console's **SQL Editor** is the fastest way:
select the restore branch in the branch dropdown (not `production` — check
this every time) and run:

```sql
-- Does the thing you lost exist again?
select id, name, "createdAt" from "Organization" order by "createdAt";

-- Did the whole schema come across? Expect ~25.
select count(*) from information_schema.tables where table_schema = 'public';
```

Or, from a terminal:

```bash
# Point at the RESTORE BRANCH, never prod. Note the distinct host.
export RESTORE_URL='postgresql://…restore-branch-host…/neondb?sslmode=require'

# 1. It answers at all.
psql "$RESTORE_URL" -c 'select now();'

# 2. The tables are there (expect the full set, ~20+ tables).
psql "$RESTORE_URL" -c '\dt'

# 3. Spot-check the thing that went missing.
psql "$RESTORE_URL" -c "select id, name, slug from \"Organization\" order by \"createdAt\";"
psql "$RESTORE_URL" -c "select count(*) from \"Shift\";"
```

Or browse it with Prisma Studio, which is usually faster for eyeballing:

```bash
cd apps/web && DATABASE_URL="$RESTORE_URL" npx prisma studio
```

**Recorded 2026-08-13:**
- **~3 minutes** from opening the create-branch dialog to a successful query.
- The branch contained **8 organizations**, including
  `QA Test — slet mig` (`cmsrazzoa000104jrhoce9oe8`), which had been deleted
  from production about 20 minutes before the restore point was queried.
  Recovering deleted rows is therefore confirmed, not assumed.
- No surprises: schema intact, no missing tables.
- The branch was created instantly and only bills for what changes, so a
  restore is cheap enough to do speculatively during an incident.

## 4. Getting data back into production

Once the branch has the good rows, copy the minimum necessary. Do **not** swap
the branch into prod unless everything is lost.

```bash
# Single org and its dependents — adjust the table list to the damage.
pg_dump "$RESTORE_URL" \
  --data-only --column-inserts \
  --table='"Organization"' --table='"Employee"' --table='"Shift"' \
  > /tmp/restore.sql

# READ IT before applying. Confirm it touches only the rows you intend.
less /tmp/restore.sql
```

Watch out, in this schema specifically:

- **Foreign key order.** `Organization` → `Membership`/`Employee` →
  `Schedule` → `Shift`. Insert parents first or the load fails halfway.
- **Duplicate schedules.** Re-inserting a `Schedule` for a week that already has
  one recreates exactly the empty-duplicate problem documented in `CLAUDE.md`
  (`findFirst` without `orderBy` then returns the wrong one). Check for an
  existing row per `(orgId, weekStart)` before inserting.
- **Cascades.** `PushSubscription`, `Membership` and others are
  `onDelete: Cascade` — deleting a `User` or `Organization` in prod to "make
  room" for the restore will take more with it than you expect.
- **Stripe fields.** `stripeCustomerId` / `stripeSubscriptionId` on
  `Organization` point at live Stripe objects. Restoring an *older* value can
  re-point an org at a subscription that has since changed. Reconcile against
  the Stripe dashboard rather than trusting the dump.

## 5. After

- [ ] Confirm the app reads the restored data (sign in, load the affected week).
- [ ] Delete the restore branch — Neon bills for it, and a stale branch invites
      someone to connect to it by mistake later.
- [ ] Confirm `DATABASE_URL` in Vercel is unchanged and still points at prod.
- [ ] Write down what happened and what the true data-loss window was.

## 6. Known gaps

- No automated backup *export* — this relies entirely on Neon's PITR window.
  Nothing here survives losing the Neon account itself. A periodic `pg_dump` to
  object storage is the fix if that risk matters.
- No alerting on data loss. Discovery today is a user noticing and reporting it.
