# Launch Checklist

Pre-launch audit as of 2026-05-15. Tick items off as they are resolved.

---

## 🔴 Blockers — cannot take customers without these

- [ ] **Stripe webhook is dead code**
  - All DB writes inside `app/api/webhooks/stripe/route.ts` are commented out.
  - No subscription ever transitions from trial → active → past-due → cancelled.
  - Stripe and the database are out of sync from day one.

- [ ] **Subscription status is never enforced**
  - `Organization.subscriptionStatus` exists in the schema but nothing reads it.
  - A cancelled customer can use the app indefinitely.
  - Needs a middleware or `requireOrgMember` check before allowing API calls.

- [ ] **Billing UI says "Coming Soon"**
  - `app/(manager)/billing/page.tsx` is a placeholder with hardcoded "Free trial" text.
  - No flow for a customer to enter a payment method, change plan, or view invoices.
  - Recommend: redirect to Stripe Customer Portal or implement Stripe Checkout.

- [ ] **Availability feature is entirely mocked**
  - `app/(employee)/availability/[token]/page.tsx` uses `MOCK_EMPLOYEE` / `MOCK_REQUEST`.
  - There is no `GET /api/availability/[token]` endpoint. Submissions go nowhere.
  - The whole availability request → employee response loop is non-functional.

- [ ] **Availability email invites are never sent**
  - Managers can create availability requests but the email-sending code is commented out.
  - Employees are never notified and have no link to submit their availability.

---

## 🟠 High — fix before first paying customer

- [ ] **Org settings lost on every refresh / cold start**
  - `lib/orgSettings.ts` is a browser-tab singleton with no backing API.
  - Business hours, currency, and view preferences vanish on page reload.
  - Neon cold starts are frequent — this will bite users constantly.
  - Fix: add `PATCH /api/orgs/[orgId]/settings` and a `settings JSON` column on `Organization`.

- [ ] **Team endpoint does not verify org membership**
  - `POST /api/orgs/[orgId]/team` checks `role !== "ADMIN"` but not that the caller
    belongs to the target org.
  - A manager of org A can call the endpoint for org B.

- [ ] **Employee invite tokens cannot be revoked**
  - Once sent, a 7-day invite link cannot be invalidated.
  - No "resend" or "revoke" action exists.
  - If leaked or forwarded, anyone with the URL can claim the invite.

- [ ] **No error boundary**
  - No `error.tsx` exists at the app or route-group level.
  - An unhandled exception renders a blank white screen with no recovery path.
  - Add `app/error.tsx` and `app/(manager)/error.tsx` at minimum.

---

## 🟡 Medium — important for a stable product

- [ ] **Time-off week-boundary logic bug**
  - `GET /api/orgs/[orgId]/time-off?weekStart=` can miss requests that straddle the
    Monday boundary, so the schedule grid may not grey out cells correctly.
  - File: `app/api/orgs/[orgId]/time-off/route.ts` — review the `lte/gte` date filter.

- [ ] **SMS failures are completely silent**
  - `lib/sms.ts` swallows all Twilio errors — no retry, no fallback, no manager alert.
  - Failed schedule-published or time-off notifications simply disappear.

- [ ] **Exchange rate fetch is a single point of failure**
  - Currency conversion calls `frankfurter.app` inline on every org settings update.
  - If that service is down the PATCH fails entirely. No cached fallback.

- [ ] **Cleanup jobs are manual, not scheduled**
  - The settings page claims automated weekly cleanup runs "every Sunday at 03:00 UTC".
  - There is no cron job — the endpoint only runs when a manager clicks the button.
  - `SchedulingEvent` table and old availability data grow unbounded.

- [ ] **Time-off GET `status` param not enum-validated**
  - Arbitrary strings pass into the Prisma `where` clause without an enum check.
  - File: `app/api/orgs/[orgId]/time-off/route.ts` GET handler.

- [ ] **`reviewNote` has no length cap**
  - Time-off denial notes are stored and forwarded to Twilio SMS with no max length.
  - Long notes will cause Twilio to split or truncate messages unpredictably.

---

## ⚪ Low — polish before growth

- [ ] **`employeeCount` on `Organization` can drift**
  - Incremented/decremented manually on add/deactivate/delete.
  - Any error mid-request leaves the counter wrong. Replace with a `_count` query.

- [ ] **`SchedulingEvent` table is unbounded**
  - Events are written on every shift/schedule action with no TTL or pagination.
  - Add a cleanup job or a 90-day retention policy.

- [ ] **`reviewNote` missing from time-off PATCH validation** *(already tracked above)*

---

## Effort estimate

| Area | Estimated effort |
|---|---|
| Stripe webhook + enforcement | 1–2 days |
| Billing UI (Stripe Checkout / Customer Portal) | 1 day |
| Availability endpoint + email invites | 1–2 days |
| Org settings persistence | 1 day |
| Team endpoint auth + invite revocation | 0.5 day |
| Error boundaries + SMS fallback | 0.5 day |
| Time-off boundary fix + exchange rate fallback | 0.5 day |
| Cleanup cron + SchedulingEvent TTL | 0.5 day |
| **Total** | **~6–8 days** |
