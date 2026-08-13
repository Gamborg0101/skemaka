# Database restore runbook (Neon)

> ⚠️ **STATUS: DRAFT — NOT YET DRILLED.** This is the procedure, written from
> the project's setup; it has **not been executed against the production Neon
> project**. Until someone runs §3 end to end and fills in the blanks marked
> `⟨fill in⟩`, treat every timing here as unknown and this document as untested.
> Doing that drill is the open checklist item — see `Before launch.md`.

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

- [ ] ⟨fill in⟩ Neon plan, and therefore the **PITR retention window**. Free
      tier historically gave ~24 h; paid plans give longer. **If the incident
      is older than the window, none of this works** — that is the single most
      important number in this document.
- [ ] ⟨fill in⟩ Project ID and the production branch name.
- [ ] Access: Neon console login, and the Vercel env vars for `DATABASE_URL`.

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

In the Neon console: **Branches → New branch → from a point in time**, choose
the production branch as parent, set the timestamp from §2, and name it
`restore-YYYYMMDD-HHMM`. Copy its connection string.

Then verify it is actually queryable before trusting it:

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

**Record for the drill:**
- ⟨fill in⟩ Wall-clock time from clicking "create branch" to first successful query
- ⟨fill in⟩ Whether the branch came up with the expected row counts
- ⟨fill in⟩ Any surprise (missing table, unexpected schema shape)

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
