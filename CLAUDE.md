@AGENTS.md

# Skemaka — project notes for AI agents

## What this is
Staff scheduling SaaS for restaurants. One org per manager. Managers schedule employees, employees view their shifts. Stack: Next.js 16 App Router, Prisma 7, Neon PostgreSQL, NextAuth 5 beta (JWT strategy), Tailwind, shadcn/ui, dnd-kit.

---

## Auth & sessions

- **NextAuth 5 beta, JWT strategy.** `auth()` is a JWT decode — no DB hit. Use it freely.
- **`orgId` is embedded in the JWT** (set in the `jwt` callback on sign-in). Access it via `session.user.orgId`.
- **`requireOrgMember(orgId)`** in `lib/apiGuard.ts`:
  - Fast path: checks `session.user.orgId === orgId` — zero DB queries.
  - Slow path (fallback): `db.membership.findFirst()` — only fires if `session.user.orgId` is absent (new user just finished onboarding, token predates this field).
- Edge middleware (`proxy.ts`) uses `authConfig` (edge-safe, no Prisma), not `lib/auth.ts`.

---

## OrgProvider / initial load

- `lib/orgContext.tsx` — `OrgProvider` fetches **one** endpoint on mount: `GET /api/me/context`.
- `/api/me/context` returns `{ org, jobRoles, shiftTemplates }` in a single Prisma query (membership with includes).
- **Do not split this back into separate calls.** Previously 3 HTTP requests with a sequential dependency; collapsed to 1 to eliminate ~8 DB round-trips on load.
- Retry logic: retries up to 3× with `delayMs * (i+1)` backoff. Only goes to `"onboarding"` on a 404. Any other non-OK response triggers a retry (Neon cold start protection).
- Shows "Waking up the database…" hint after 4 s of loading.

---

## Neon (serverless Postgres)

- Neon cold-starts take ~10–15 s after ~5 min idle. `connectionTimeoutMillis: 30_000` is set on the adapter in `lib/prisma.ts` to survive this.
- **Always use `orderBy` on `findFirst`** — without it Neon/Postgres returns an indeterminate row, which has bitten us (returned an empty duplicate schedule instead of the seeded one).
- If all data seems to disappear, check for duplicate empty records before assuming data loss.

---

## Key files

| File | Purpose |
|---|---|
| `lib/auth.ts` | NextAuth config, JWT callback (sets `id`, `role`, `orgId`) |
| `lib/auth.config.ts` | Edge-safe subset used by middleware |
| `proxy.ts` (root) | Middleware — auth guards for pages + API routes |
| `lib/apiGuard.ts` | `requireOrgMember` — fast JWT check + DB fallback |
| `lib/orgContext.tsx` | `OrgProvider` + `useOrg()` hook |
| `lib/orgSettings.ts` | Module-level singleton for org settings (currency, hours, view). `updateOrgSettings()` updates it. |
| `lib/prisma.ts` | Prisma client with Neon adapter (30 s timeout) |
| `lib/serialize.ts` | Prisma → plain-object helpers (`serOrg`, `serShift`, etc.) |
| `lib/dateUtils.ts` | `getMondayOfWeek`, `addDays`, `getISOWeek` |
| `app/api/me/context/route.ts` | Single context endpoint (org + roles + templates) |
| `components/manager/ShiftTimeline.tsx` | Main drag-and-drop scheduling timeline |

---

## Currency & org settings

- `lib/orgSettings.ts` holds a **client-side module singleton** (`_settings`). Always use `formatCurrency()` and `getCurrencySymbol()` from here — never hardcode EUR or `"de-DE"` locale.
- Settings are persisted via `PATCH /api/orgs/[orgId]/settings` and synced into the singleton via `updateOrgSettings()`.

---

## Schedule / shift data shapes

- `weekStart` is always a `YYYY-MM-DD` ISO date string (Monday). Use `getMondayOfWeek(new Date())` to get the current week.
- Shift `date` field is also `YYYY-MM-DD`. Shifts belong to a `Schedule` (one per week per org).
- `GET /api/orgs/[orgId]/schedules?week=YYYY-MM-DD` — use `orderBy: { createdAt: "asc" }` on the `findFirst` to always get the canonical schedule, not a potential empty duplicate.

---

## Drag-and-drop timeline (ShiftTimeline.tsx)

- Uses dnd-kit. Employee chips are `useDraggable`; timeline rows are `useDroppable`.
- **Block check uses `drag.employee.id`** (the chip being dragged), NOT `drop.employeeId` (the target row). Getting this backwards causes false "already has a shift" blocks.
- Chips with `isScheduled=true` are disabled (`useDraggable({ disabled: true })`) and shown with a grey "Scheduled" badge.
- 15-minute snap: `snapTimeFromPointer(pointerX, rowRect)` in `ShiftTimeline.tsx` — rounds pointer position to nearest 15 min and pre-fills `defaultStartTime` in `AddShiftDialog`.

---

## Screenshots

Current screenshots of the app live in `screenshots/`. Use them to understand the UI before making changes. **Always retake the relevant screenshot after UI work and verify it looks correct — never leave a stale screenshot behind.**

| File | What it shows |
|---|---|
| `screenshots/00-login.png` | Login / marketing page |
| `screenshots/01-schedule.png` | Schedule — week grid view |
| `screenshots/02-employees.png` | Employees list |
| `screenshots/03-availability.png` | Availability requests |
| `screenshots/04-costs.png` | Labor costs |
| `screenshots/05-time-off.png` | Time-off requests |
| `screenshots/06-settings.png` | Settings page |
| `screenshots/07-schedule-timeline.png` | Schedule — timeline view |
| `screenshots/08-my-shifts.png` | My Shifts page |

---

## Task verification

When working through a multi-step task, include verification steps in the task list — don't just mark work done, confirm it. Example: build the UI, then take a screenshot and check for layout errors before reporting back. For API changes, hit the endpoint and assert the response shape. For refactors, run the type-checker. The goal is to catch regressions before asking for feedback, not after.

---

## Patterns to follow

- `serXxx()` helpers in `lib/serialize.ts` must be used before returning Prisma objects in API responses (converts `Decimal` → `number`, `Date` → ISO string).
- Route context params are `Promise<{ ... }>` in Next.js 16 — always `await params`.
- Never use `findFirst` without `orderBy` when duplicates might exist.
- `"use client"` is required on any component that imports from `lib/orgSettings.ts` (module singleton only exists client-side).
