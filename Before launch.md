# Before Launch — Skemaka Go-to-Market Checklist

> **Single source of truth for go-live.** Absorbed `LAUNCH.md` (2026-07-12
> runbook) on 2026-08-13; that file is now a pointer stub. Earlier ancestors:
> `LAUNCH_CHECKLIST.md`, `GO_LIVE_RUNBOOK.md`, `LAUNCH_PLAN.md` (2026-06).
>
> Prod is live at **skemaka.com**. CI (typecheck + lint + unit) and the nightly
> E2E are green. What remains is mostly **operational** — consoles, keys,
> verification — not engineering.
>
> ⚠️ **Your launch docs are all local-only.** `.git/info/exclude` lists both
> `/Before launch.md` (line 9) and `/docs/` (line 10), so this checklist *and*
> `docs/restore-runbook.md` are untracked — they do not survive a fresh clone,
> and no collaborator or future session can see them. The old `LAUNCH.md` even
> carried a checklist item to "commit `docs/restore-runbook.md`", which that
> exclude rule quietly prevents. Decide whether it is deliberate; if not, drop
> those two lines from `.git/info/exclude` and commit both.

## 📋 TODO — picking this back up (as of 2026-08-13)

A launch-readiness audit ran on 2026-08-12. Its code findings shipped in
**PR #42 — merged to `main` 2026-08-12** (deployed to prod via Vercel).
Verified there by execution: typecheck 6/6 · lint 0 errors · unit 596 ·
integration 29 under both UTC and UTC+14 · e2e 17 · production build ·
migrations replayed from empty with no drift.

What is left needs either a device or your signature.

**Re-verified 2026-08-13 by execution:** typecheck 6/6 green · lint 0 errors /
14 warnings · **672 tests passing** (596 web + 76 new in `packages/api`) ·
`npm audit` 20 advisories, **0 of them in `apps/web`** · `eas.json` ios creds
still empty · `checks: ["pkce", "state"]` present in both auth files · Stripe
webhook handles exactly the four expected events ·
`20260709000000_add_push_subscriptions` migration exists, so schema and
migrations are in sync.

**Cleared 2026-08-13:** `packages/api` test suite written (76 tests) · the four
stale screenshots deleted · `docs/restore-runbook.md` drafted (procedure only —
the drill itself is still owed) · one real bug found and fixed in
`cancelCoverRequest` · `packages/api` React pin realigned 18 → 19.1.0.

---

### 🔴 Do first — one unverified change is now live in prod

- [ ] **Test Google sign-in, web AND mobile.** PR #42 restored
      `checks: ["pkce", "state"]` (Auth.js's default). PKCE was removed in May
      2026 during mobile work (`7c6b214`), so that flow may have depended on its
      absence — and it is the one change that could not be verified without a
      device. It is in prod now, so this is a live-traffic risk, not a
      pre-merge one.
      - Web: incognito → `/login` → Continue with Google → should land on
        `/schedule`. Failure looks like `/login?error=OAuthCallbackError`.
      - Mobile: Expo app → Google sign-in (leaves for the system browser and
        returns via `/api/auth/mobile/complete`).
      - If mobile breaks: revert `["pkce", "state"]` → `["state"]` in
        `apps/web/auth.config.ts` **and** `apps/web/lib/auth.ts`. The real fix is
        the `code_verifier` cookie's sameSite/partitioning, not weakening every
        browser sign-in again.

---

### 🔴 Blocking a first paying customer — yours, not the code's

- [x] ~~**The lapsed-trial dead end**~~ — **fixed 2026-08-13 (PR #44).** Found by
      looking at prod: **skemaka.com has been returning 402 on every API call
      since ~2026-07-16** (org created 2026-07-02 + 14-day trial). No client
      code handled 402 at all, so `/schedule` rendered *"Ingen medarbejdere
      endnu — tilføj din første medarbejder"*: a lapsed customer was shown what
      reads as **deleted data**, with no route to pay. There is now a paywall
      that says what happened, promises the data is safe, and links to
      `/billing`; `/billing` itself stays reachable and its banner no longer
      claims "Full access during your trial" while the account is locked.
      **Your org is still locked** — subscribing is what unlocks it, which is
      gated on the Stripe price below.

- [ ] **Stripe Tax registration** (needs the Danish company registered). Prices
      are tax-exclusive and no VAT is being collected on any sale today.
- [ ] **Create the live tiered price + set `STRIPE_PRICE_ID`.** PR #10 was
      closed, but the pricing model shipped to `main` anyway: `lib/pricing.ts`
      is `€19 base (first 5 seats included) + €3.50 per seat above 5`. The
      Stripe price must be **GRADUATED**-tiered — tier 1 (up to 5 units) flat
      €19.00 / €0 per unit, tier 2 (6+ units) €3.50 per unit. **Not volume**:
      volume re-rates every unit at the matched tier, giving a different and
      cheaper `max(19, seats × 3.50)`. `pricing.test.ts` pins the arithmetic;
      if you change the Stripe price, change the constants in the same commit.
- [ ] **Decide + execute migration of existing subscriptions on the old €3
      price** (grandfather or move).
- [ ] **⚠️ Verify Resend has a verified domain — this may be a hard blocker.**
      Found 2026-07-16: the Resend account had **zero verified domains**, and
      `apps/web/.env.local` still reads `RESEND_FROM_EMAIL="onboarding@resend.dev"`
      (re-confirmed 2026-08-13). Resend's sandbox sender only delivers to the
      account owner's address, so **employees receive no email at all** —
      invites, schedule publishes, roll-outs all silently go nowhere. The prod
      Vercel value can't be checked from the repo, so check the Resend
      dashboard: verify `skemaka.com` (SPF/DKIM DNS) and set
      `RESEND_FROM_EMAIL="Skemaka <noreply@skemaka.com>"` in both Vercel and
      `.env.local`. Code side is ready — all send sites go through `emailFrom()`
      in `lib/resend.ts`. This is the same issue as the "Email deliverability"
      check below, but it is a blocker, not a smoke test.
- [ ] **Twilio trial → paid**, before staff are expected to receive rotas. On a
      trial, messages only reach console-verified numbers and arrive prefixed
      "Sent from a Twilio trial account". Sends are logged, never thrown, so this
      fails silently.
- [ ] **Check the live Stripe delivery log right after the first real
      subscription.** A wrong `STRIPE_WEBHOOK_SECRET` returns 400 and Stripe
      retries for ~3 days. Note the webhook now returns **500 and stays
      retryable** on a genuine processing failure instead of a false
      `200 duplicate`, so failures show up as retries rather than silence.

---

### 🔴 One-time console verification (~30 min, from the old LAUNCH.md §2/§4/§5)

**Prod env vars** (Vercel → Settings → Environment Variables). Required at boot
— a deploy fails fast listing anything missing (`instrumentation.ts`):
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`NEXTAUTH_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`,
`RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPERADMIN_EMAIL`, `CRON_SECRET`, and
Upstash (`UPSTASH_REDIS_REST_*` or `KV_REST_API_*`). Prod boots today, so these
are set.

- [ ] **Web push keys.** The push code (`PushSubscription` model, service
      worker) is in `main` even though PR #9 was closed. To make it actually
      send: `npx web-push generate-vapid-keys` → set
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (optional
      `VAPID_SUBJECT`, defaults to mailto:support@skemaka.com), then
      `cd apps/web && npx prisma db push` against prod Neon to create the
      `PushSubscription` table. Verified no-op without the keys — safe to defer.
- [ ] **Twilio env** (if SMS is day-one): `TWILIO_ACCOUNT_SID`,
      `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` present in prod.
- [ ] ⛔ **Confirm absent in prod:** `E2E_TEST_LOGIN`, `E2E_TEST_PASSWORD`,
      `TWILIO_TO_OVERRIDE` — all three are enforced: boot refuses if set
      (`instrumentation.ts` `FORBIDDEN_ENV_VARS`). Also confirm `NEON_WS_PROXY`
      is absent — **this one is not boot-enforced**, it just silently rewires
      the Neon connection (`lib/prisma.ts:10`), so it needs an eyeball.
- [ ] **Stripe webhook:** live endpoint `https://skemaka.com/api/webhooks/stripe`
      subscribes to exactly `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.payment_failed` — and shows 200s in the delivery dashboard.
- [ ] **Rate limiting:** >20 req/10 s to a public endpoint → 429; no
      "Rate limiting is DISABLED" in prod logs (API fails closed without Upstash).
- [ ] **Crons:** Vercel → Cron Jobs shows `/api/cron/cleanup` (**daily** 03:00)
      and `/api/cron/bug-report-digest` (daily 07:00); trigger each once → 200.
      (The old runbook said cleanup runs Sundays — `apps/web/vercel.json` has
      `0 3 * * *`, i.e. daily. Verify against the daily schedule.)
- [ ] **Email:** Resend domain verified; invite + publish emails deliver (not
      spam-foldered) from `RESEND_FROM_EMAIL`.
- [ ] **Google OAuth:** consent screen **published** (not testing mode); prod
      redirect URI `https://skemaka.com/api/auth/callback/google` present.
      (Pairs with the PKCE test above.)
- [ ] **DB schema sanity:** `npx prisma migrate status` / Neon console — prod
      has all tables through the newest migration,
      `20260730230000_pending_seats_effective_at`. (Locally the migration
      folder is complete and matches `schema.prisma`, including
      `20260709000000_add_push_subscriptions` — the check is whether *prod*
      has caught up, since prod is applied with `db push`.)
- [ ] **SMS compliance** (if day-one): sender registration for the target market
      — A2P 10DLC is US-only; for Denmark/EU register the sender / alphanumeric
      ID with Twilio. Inbound webhook
      `https://skemaka.com/api/webhooks/twilio/sms` configured; text STOP →
      suppressed + `SmsOptOut` row; START → restored.
- [ ] **Recommended once:** dunning drill with a Stripe test clock —
      `invoice.payment_failed` → PAST_DUE → 14-day grace → 402.

---

### 🟡 Next, once someone is paying

- [ ] **Neon PITR restore drill** — still never done, and outstanding in every
      version of this doc since June. `docs/restore-runbook.md` now exists as a
      **written but undrilled** procedure: branch-not-in-place restore, the
      FK/duplicate-schedule/Stripe-field traps, and the cleanup steps. What it
      cannot supply is the part that needs your console — **confirm the Neon
      plan's PITR retention window** (the single most important number: an
      incident older than the window is unrecoverable), then restore once to a
      scratch branch, confirm it is queryable, and fill in the `⟨fill in⟩`
      blanks. Until then there is no tested answer to "I dropped the wrong org".
- [ ] **Uptime check + alerting.** Client crashes now POST to `/api/bug-report`
      (persisted, emailed, visible on `/platform/errors`), but the digest is
      daily and nothing watches whether the site is up. Today's monitoring is
      structured JSON logs (search Vercel by `requestId`) + that digest to
      `SUPERADMIN_EMAIL`. No Sentry — known gap, accepted for launch.
- [ ] **`expo@57`** clears the last 20 npm advisories (9 moderate, 11 high).
      Confirmed 2026-08-13: `npm audit --workspace apps/web` = **0
      vulnerabilities**, so none of this touches the deployed web app — it is
      all React Native / Expo build tooling (metro, @expo/prebuild-config,
      xcode, image-size, postcss, uuid). Currently on `expo@~54.0.35`. A major
      — give it its own window, before App Store submission.
- [x] ~~**Test `packages/api`**~~ — **done 2026-08-13.** 76 tests across
      `src/__tests__/{client,api,hooks}.test.ts`, wired into `npm run test` via
      turbo. Covers the bearer/refresh logic (single-flight refresh on
      concurrent 401s, no retry loop, proactive expiry), pagination, response
      unwrapping, and every hook's query key, `enabled` gate and cache
      invalidation. Found and fixed one real bug (below); `packages/api` was
      also pinned to React 18 while both apps run 19.1.0 — now aligned.
- [ ] **⚠️ New finding: the list hooks silently truncate.** `useEmployees` and
      `useTimeOff` call the list endpoints directly and read `res.data`, taking
      **only the first page** — while `api.ts`'s `listEmployees` / `getAllTimeOff`
      page through properly with `getAllPages`. Server defaults are **100** for
      employees and **50** for time-off, so a mobile user sees at most that
      many, with no indication more exist. Not launch-blocking (mobile trails,
      and no org is near 100 staff), but it will bite on time-off first, since
      those accumulate. Fix is either to route the hooks through the paging
      helpers or to make the truncation visible. Left unchanged deliberately —
      it changes mobile fetch behaviour, which wants a device to verify.
- [ ] **Move production to `migrate deploy`.** It uses `db push` today, which
      makes the DB match `schema.prisma` and therefore silently drops anything
      Prisma cannot express — which is why the two rota/clock invariants are
      enforced with `SELECT … FOR UPDATE` (`lib/services/locks.ts`) rather than
      partial unique indexes. Once on `migrate deploy`, add the indexes too.

---

### 🟢 Loose ends

- [x] ~~Decide on four stale screenshot files~~ — **deleted 2026-08-13.**
      `00-login-dark.png`, `dark-login.png`, `verify-login-dark.png`,
      `verify-login-light.png` were May-era one-off theme QA artifacts, absent
      from the CLAUDE.md screenshot table and superseded by `00-login.png`
      (retaken 2026-08-12). Removed with `git rm`, so `git revert` brings them
      back if you disagree. What remains matches the documented table.
- [ ] `qa-01-schedule.png` in the repo root — left alone. It is **untracked and
      gitignored** (`.gitignore:64` `/*.png`), so deleting it is not
      recoverable; your call, but nothing depends on it.
- [ ] 14 `react-hooks/set-state-in-effect` lint warnings — still exactly 14
      (0 errors). Cascading renders in `lib/useScheduleData.ts:60`,
      `components/pwa/usePushSubscription.ts:51` and a few dialogs. A
      performance smell, invisible at current data sizes.
- [ ] `lib/orgSettings.ts:6` still carries the repo's only TODO (confirmed:
      1 repo-wide) — "replace with real API calls to
      `/api/orgs/[orgId]/settings`". The module-level client singleton is what
      forces `"use client"` on every consumer.

---

### 📱 Mobile / App Store — can trail the web launch

`eas.json` already points at `https://skemaka.com`. Detail in
`apps/mobile/APP_STORE_SUBMISSION.md`.

- [ ] Fill `eas.json` `submit.production.ios` creds: `appleId`, `ascAppId`,
      `appleTeamId` — confirmed 2026-08-13, all three are still `""`
- [ ] Apple Developer: enable "Sign in with Apple" on `com.skemaka.app`
- [ ] Seed a demo MANAGER review account with realistic data; enter creds in
      App Store Connect + support email/URL
- [ ] `eas build` → `eas submit`

---

## Go / No-Go

**GO for web when:** the PKCE sign-in test passes · Stripe live price created and
`STRIPE_PRICE_ID` set · env vars confirmed (including the ⛔ absent list) ·
webhook verified · rate-limit / cron / email / OAuth checks pass · backup drill
done. SMS and mobile may trail if not day-one critical.

**First 48 h:** watch Vercel logs for `level:"error"` lines (correlate by
`requestId`); confirm the daily digest arrives; watch Stripe webhook deliveries
for retries piling up.

---

## Post-launch backlog (gate on metrics — from the old Phase 3)

- E2E for the full Stripe checkout money path (webhook + guard logic is
  unit/E2E tested; the checkout redirect flow itself is not).
- Load-test hot endpoints at ~100-org scale; verify indexes with EXPLAIN.
- Keep-warm cron for Neon cold starts; per-org (not per-IP) rate limits.
- Nightly Stripe quantity reconciliation against active seat counts.
- Convert `Shift.startTime/endTime` strings to real time types.
- Scrub old Playwright debug files from git history if the repo ever goes public.

Then: ship 🚀
