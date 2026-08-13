# QA Report — Skemaka (localhost:3000)

- **Date:** 2026-07-05
- **Branch:** feat/pwa-install
- **Mode:** Full user-journey (report-only, /qa-only)
- **Framework:** Next.js 16 (App Router)
- **Auth used:** E2E credentials provider (dev-only), signed in as org manager
- **Pages visited:** landing, login, demo, schedule (week + timeline), employees, availability, labour cost, time off, my shifts, settings, billing, join/[token], availability/[token], verify-phone, portal, onboarding, terms, privacy
- **Screenshots:** 40+ in `.gstack/qa-reports/screenshots/`

## Health score: 62/100

| Category | Score | Weight | Notes |
|---|---|---|---|
| Console | 70 | 15% | 4xx errors surfaced from real bugs (manifest.json 404, apple-touch-icon 404, sick-day 400, time-off 400) |
| Links | 85 | 10% | /pricing does not exist (only probed; verify nothing links to it), manifest.json + apple-touch-icon 404 |
| Visual | 90 | 10% | Very consistent UI; minor issues only |
| Functional | 40 | 20% | Sick-day broken, portal time-off broken, invite claim dead-ends |
| UX | 55 | 15% | Irreversible one-click sends, generic error toasts, required-field discovery |
| Performance | 90 | 10% | Snappy after Neon warm-up; no CLS observed |
| Content | 65 | 5% | Copy bug on verify-phone; marketing claims not yet true (staff app, SMS); EUR vs DKK mismatch |
| Accessibility | 75 | 15% | Good ARIA on dialogs/grids; day-cell actions only discoverable on hover; unlabeled comboboxes in Add Shift |

## Top 3 things to fix

1. **ISSUE-001 — Employee invite link dead-ends (launch blocker).** The `/join/[token]` link from the invite email shows "Link failed — Unauthorized" for logged-out visitors — and every invited employee is logged out. The escape hatch ("Go to portal anyway") goes to plain `/login` (Google-only), losing the invite token entirely. New employees cannot activate their accounts.
2. **ISSUE-002 — "Mark sick" always fails.** Every "Mark sick" button in the week grid POSTs to the shifts endpoint and gets a 400, then shows the generic toast "Failed to register sick day". Reproduced twice.
3. **ISSUE-003 — Portal time-off request fails.** Submitting the portal Time Off form with both dates filled returns the raw API error "employeeId, startDate, and endDate are required". The employee-facing time-off flow is broken.

---

## Issues

### ISSUE-001 — Invite claim page shows "Link failed: Unauthorized" for logged-out employees
- **Severity:** Critical (launch blocker) | **Category:** Functional
- **Repro:** Sign out → open `/join/<valid-invite-token>` → "Link failed — Unauthorized" card. Click "Go to portal anyway" → lands on `/login` with no callback back to the claim URL.
- **Expected:** Claim page should let the invitee authenticate (magic link / Google) and then complete the claim, preserving the token through the auth round-trip.
- **Root cause (from code):** `ClaimInviteClient.tsx` immediately POSTs `/api/me/claim-invite/request-code`, which middleware 401s for anonymous visitors — the page renders the raw "Unauthorized" as "Link failed". Fix: detect no-session and redirect to `/login?callbackUrl=/join/<token>` (and expose an email sign-in method — see ISSUE-004).
- **Evidence:** `screenshots/33-invite-claim.png`, `screenshots/34-portal-anyway.png`

### ISSUE-002 — "Mark sick" 400s with generic error
- **Severity:** High | **Category:** Functional
- **Repro:** Schedule → week view → click any "Mark sick" cell action → toast "Failed to register sick day". Server log: `POST /api/orgs/.../shifts 400`. Reproduced twice on different cells.
- **Root cause (from code):** `lib/useShiftMutations.ts:111` posts a sick shift with `startTime: "00:00", endTime: "00:00"`; the shifts route rejects equal times ("startTime and endTime must differ", `shifts/route.ts:58`). The feature can never succeed.
- **Evidence:** `screenshots/30-mark-sick.png`, `screenshots/32-mark-sick-retry.png`

### ISSUE-003 — Portal time-off submit fails with raw API validation error
- **Severity:** High | **Category:** Functional
- **Repro:** `/portal` → Time Off → Request → fill From 2026-07-20, To 2026-07-22, reason → Submit → toast "employeeId, startDate, and endDate are required".
- **Expected:** Request created and shown as pending. Client must send employeeId + ISO dates; API errors should never surface raw to staff.
- **Root cause (from code):** `time-off/route.ts:75` — for callers with MANAGER role the API requires `body.employeeId`, but the portal form never sends it. Managers using their own portal always 400; plain employees are unaffected. Fix: fall back to the caller's own employee record when `employeeId` is absent.
- **Evidence:** `screenshots/46-timeoff-submitted.png`

### ISSUE-004 — Login is Google-only while invite email promises a magic link
- **Severity:** High (funnel risk) | **Category:** Functional / Content
- **Repro:** `/login` shows only "Continue with Google". The Add Employee dialog says "The employee will receive an invite email with a magic link to access their portal." Resend provider exists in code but is not exposed in the UI.
- **Impact:** Staff without Google-linked email addresses cannot sign in at all.
- **Evidence:** `screenshots/34-portal-anyway.png`

### ISSUE-005 — Availability request sends instantly with no dialog, for the current (already-ending) week
- **Severity:** High (UX) | **Category:** UX
- **Repro:** Availability page (viewing W27, whose last day is today) → click "Send Availability Request" → instantly emails all active employees, deadline "Sunday 5 July" = today.
- **Expected:** A confirm step with week selection and deadline (the API already accepts a datetime deadline). Default should be a *future* week.
- **Evidence:** `screenshots/23-availability-request-dialog.png`

### ISSUE-006 — Publish is one-click with no confirmation or summary
- **Severity:** Medium | **Category:** UX
- **Repro:** Schedule → Publish → fires immediately ("Publishing…", then "Published ✓"). No summary of what changed / who gets notified, no undo.
- **Evidence:** `screenshots/19-publish-dialog.png`, `screenshots/20-after-publish.png`

### ISSUE-007 — "Code sent" / "notified by SMS" claimed even when no SMS goes out
- **Severity:** Medium | **Category:** Functional / Trust
- **Detail:** The pre-filled OTP is a deliberate, NODE_ENV-gated dev affordance (`devCode`, never returned in production) — not a leak. The real bug: `sendPhoneVerificationSms()` returns `false` when Twilio is unconfigured or the send fails, but `request-code/route.ts` ignores the return value and responds `sent: true` ("We texted a 6-digit code"); likewise publish shows "employees notified by SMS" unconditionally (`useScheduleData.ts:216`). In prod with a Twilio outage/misconfig, employees are told a code/notification was sent when nothing was.
- **Action:** Propagate the send result; on failure surface an error state. Add TWILIO_* to the production env checklist.
- **Evidence:** `screenshots/43-verify-phone-send.png`, `lib/sms.ts:117`

### ISSUE-008 — `/apple-touch-icon.png` 404 (PWA branch)
- **Severity:** Low-Medium (this branch's feature) | **Category:** Functional
- **Detail:** No source file references `/manifest.json` (those 404s were QA probes; `/manifest.webmanifest` works). But Safari/iOS probes `/apple-touch-icon.png` by convention and it 404s. `app/apple-icon.png` exists and Next serves it at `/apple-icon.png` with a link tag — pages outside the root layout scope or crawlers using the conventional path still miss. Add a `public/apple-touch-icon.png` copy.
- **Evidence:** curl `/apple-touch-icon.png: 404`; server log

### ISSUE-009 — Duplicate-shift rejection shows generic "Failed to add shift"
- **Severity:** Medium | **Category:** UX
- **Repro:** Add a shift for an employee who already has one that day (via employee dropdown in Add Shift) → dialog closes, input lost, toast "Failed to add shift" with no reason.
- **Expected:** Keep dialog open, explain "Anna already has a shift on Monday".
- **Evidence:** `screenshots/12-one-shift-per-day-test.png`

### ISSUE-010 — Required fields discovered one at a time in Add Employee
- **Severity:** Medium | **Category:** UX
- **Repro:** Add Employee → submit → "Please fill out this field" on Name → fill → submit → same on Email → then Phone → then Wage. Four failed submits to learn the required set; no asterisks or upfront indication. Email AND phone are hard-required — restaurant staff without email cannot be added at all.
- **Evidence:** `screenshots/03…06-*.png`

### ISSUE-011 — Timeline "7d" clamps to the week and can show a single day
- **Severity:** Medium | **Category:** UX
- **Repro:** Timeline view on Sunday → click "7d" → still shows only Sunday (range clamps at week end). On Saturday it shows 2 days. Selecting "7d" never spans into next week and doesn't re-anchor to Monday.
- **Also:** default Timeline view on a CLOSED day (Sunday) renders an all-"CLOSED" screen with nothing actionable.
- **Evidence:** `screenshots/14-timeline-7d.png`, `screenshots/15-timeline-7d-prev.png`

### ISSUE-012 — Week grid shows Mon–Fri with dead space; Sat/Sun behind a pager
- **Severity:** Low | **Category:** UX
- **Repro:** Schedule week view at 1280px: columns end at Friday with empty whitespace to the right; Sat/Sun require the "Next days" arrows (weekend shifts exist but are invisible by default).
- **Evidence:** `screenshots/01-schedule.png`

### ISSUE-013 — Copy bug: "The small cafeneeds a number"
- **Severity:** Low | **Category:** Content
- **Repro:** `/verify-phone` subtitle — missing space between org name and "needs".
- **Evidence:** `screenshots/42-portal.png`

### ISSUE-014 — Minor content/visual nits
- **Severity:** Low | **Category:** Content / Visual
- Add Employee wage placeholder "15.00" reads as USD/EUR default in a DKK org (`screenshots/03`).
- "0 sick days this month" shown in red alert styling on the employee sheet (`screenshots/29`).
- My Shifts header shows the week range twice ("W27 29 Jun – 5 Jul · 29 Jun – 5 Jul W27") (`screenshots/28`).
- Marketing pricing is EUR (€3) while the product is DKK-first; landing promises "Free staff app (iOS & Android)" and "SMS when you publish" — both not launch-ready today (mobile app unreleased, SMS unconfigured).
- Billing page's "Free trial" banner has no trial end date (`screenshots/27`).

---

## What works well

- Core scheduling loop: add employee → add shifts (dialog + drag with 15-min snap) → edit/resize → publish → employee portal shows published shifts. Solid.
- One-shift-per-day rule enforced server-side (enforcement correct; only messaging is bad).
- Labour cost math and DKK formatting are correct; CSV export offered.
- Token-based availability submission (no login needed) is exactly right for restaurant staff, and the round-trip to the manager grid works (Full day / Unavailable / Scheduled states).
- Availability page progress ("1/3 submitted"), hours-vs-contract badges, publish state, "Not activated" employee badges — good operational visibility.
- Landing page + demo restaurant are genuinely persuasive; empty states are clean; light/dark theming consistent.
- Returning-user onboarding redirect works (`/onboarding` → `/schedule`).

## Not covered

- New-user onboarding wizard (org creation) — requires a fresh Google sign-in; covered in code review instead.
- Real email/SMS delivery, Stripe checkout completion, mobile app.

## Baseline
`baseline.json` written alongside this report for future regression runs.
