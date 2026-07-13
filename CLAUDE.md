@AGENTS.md

# Skemaka — project notes for AI agents

## Monorepo structure

```
skemaka/                    ← workspace root (Turborepo + pnpm)
├── apps/
│   ├── web/                ← Next.js 16 web app
│   └── mobile/             ← Expo 53 React Native app
├── packages/
│   ├── types/              ← @skemaka/types  — shared TypeScript interfaces
│   ├── api/                ← @skemaka/api    — ApiClient + TanStack Query hooks
│   └── ui/                 ← @skemaka/ui     — shared design tokens + cn()
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

All paths below are relative to `apps/web/` unless prefixed with `packages/` or `apps/mobile/`.

---

## What this is
Staff scheduling SaaS for restaurants. One org per manager. Managers schedule employees, employees view their shifts. Stack: Next.js 16 App Router, Prisma 7, Neon PostgreSQL, NextAuth 5 beta (JWT strategy), Tailwind, shadcn/ui, dnd-kit.

---

## Auth & sessions

- **NextAuth 5 beta, JWT strategy.** `auth()` is a JWT decode — no DB hit. Use it freely.
- **`orgId` and `role` are embedded in the JWT** (set in the `jwt` callback on sign-in). Access via `session.user.orgId` / `session.user.role`.
- **JWT role is set from the MANAGER membership, not the User model.** The User model defaults to `EMPLOYEE`; only the membership record matters. The jwt callback sets `token.role = "MANAGER"` if a manager membership is found.
- **`requireOrgMember(orgId)`** in `lib/apiGuard.ts`:
  - Fast path: checks `session.user.orgId === orgId` — zero DB queries.
  - Slow path (fallback): `db.membership.findFirst()` — only fires if `session.user.orgId` is absent (new user just finished onboarding, token predates this field).
- **ManagerLayout** has the same slow-path fallback: if `session.user.role` is not MANAGER/ADMIN, it does a DB membership check. If no membership → `/onboarding`. This handles the window between org creation and next sign-in.
- **Login redirects to `/onboarding`** (not `/schedule`). Onboarding checks `/api/me/context` and redirects returning users to `/schedule` immediately. New users see the onboarding wizard.
- Edge middleware (`proxy.ts`) uses `authConfig` (edge-safe, no Prisma), not `lib/auth.ts`.
- **Mobile auth**: Bearer token from `GET /api/auth/mobile/session`, stored in Keychain via `expo-secure-store`. Refreshed via `POST /api/auth/mobile/refresh`.

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
| `apps/web/lib/auth.ts` | NextAuth config, JWT callback (sets `id`, `role`, `orgId`) |
| `apps/web/lib/auth.config.ts` | Edge-safe subset used by middleware |
| `apps/web/proxy.ts` | Middleware — auth guards for pages + API routes |
| `apps/web/lib/apiGuard.ts` | `requireOrgMember` — fast JWT check + DB fallback |
| `apps/web/lib/orgContext.tsx` | `OrgProvider` + `useOrg()` hook |
| `apps/web/lib/orgSettings.ts` | Module-level singleton for org settings (currency, hours, view). `updateOrgSettings()` updates it. |
| `apps/web/lib/prisma.ts` | Prisma client with Neon adapter (30 s timeout) |
| `apps/web/lib/serialize.ts` | Prisma → plain-object helpers (`serOrg`, `serShift`, etc.) |
| `apps/web/lib/dateUtils.ts` | `getMondayOfWeek`, `addDays`, `getISOWeek` |
| `apps/web/app/api/me/context/route.ts` | Single context endpoint (org + roles + templates) |
| `apps/web/components/manager/ShiftTimeline.tsx` | Main drag-and-drop scheduling timeline |
| `packages/types/src/index.ts` | Canonical shared TypeScript interfaces |
| `packages/api/src/client.ts` | ApiClient — fetch wrapper with Bearer auth |
| `packages/api/src/hooks/` | TanStack Query hooks (used by mobile app) |
| `apps/mobile/src/store/authStore.ts` | Zustand auth store + expo-secure-store |
| `apps/mobile/metro.config.js` | Metro monorepo config (watchFolders, nodeModulesPaths) |

---

## Shared types (@skemaka/types)

- **Canonical source**: `packages/types/src/index.ts`
- **Web app**: imports via `@/types` (which re-exports from `@skemaka/types`) — no internal imports change.
- **Mobile app**: imports directly from `@skemaka/types`.
- When adding new types, edit `packages/types/src/index.ts` only.

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

Current screenshots of the app live in `apps/web/screenshots/`. Use them to understand the UI before making changes. **Always retake the relevant screenshot after UI work and verify it looks correct — never leave a stale screenshot behind.**

| File | What it shows |
|---|---|
| `apps/web/screenshots/00-login.png` | Login / marketing page |
| `apps/web/screenshots/01-schedule.png` | Schedule — week grid view |
| `apps/web/screenshots/02-employees.png` | Employees list |
| `apps/web/screenshots/03-availability.png` | Availability requests |
| `apps/web/screenshots/04-costs.png` | Labor costs |
| `apps/web/screenshots/05-time-off.png` | Time-off requests |
| `apps/web/screenshots/06-settings.png` | Settings page |
| `apps/web/screenshots/07-schedule-timeline.png` | Schedule — timeline view |
| `apps/web/screenshots/08-my-shifts.png` | My Shifts page |
| `apps/web/screenshots/landing-desktop-hero.png` | Landing page — desktop hero (unauthenticated `/`) |

---

## Task verification

When working through a multi-step task, include verification steps in the task list — don't just mark work done, confirm it. Example: build the UI, then take a screenshot and check for layout errors before reporting back. For API changes, hit the endpoint and assert the response shape. For refactors, run the type-checker. The goal is to catch regressions before asking for feedback, not after.

---

## Running the project

```bash
# Install (pnpm required — see SETUP.md)
pnpm install

# Web dev server
pnpm dev:web         # or: cd apps/web && pnpm dev

# Mobile dev server (Expo)
pnpm dev:mobile      # or: cd apps/mobile && pnpm dev

# Typecheck all packages
pnpm typecheck

# Prisma (always run from apps/web/)
cd apps/web && npx prisma db push
cd apps/web && npx prisma generate
```

---

## i18n (next-intl + @skemaka/i18n)

- **Catalogs live in `packages/i18n/src/messages/<locale>/<namespace>.json`** — English is the source language; namespaces: `common`, `marketing`, `auth`, `onboarding`, `portal`, `manager`, `dialogs`, `emails`, `sms`. A parity test (`lib/__tests__/i18n.test.ts`) fails CI if any locale's keys or ICU placeholders drift from English.
- **Adding a string**: add the key to `en/<ns>.json` AND every other locale, then use `useTranslations("<ns>")` (client/RSC) or `getTranslations()` (async server) from next-intl. Never hardcode user-visible copy.
- **Adding a locale**: extend `SUPPORTED_LOCALES`, `LOCALE_LABELS`, `LOCALE_TAGS` in `packages/i18n/src/locales.ts`, create `messages/<locale>/`, and translate `quotes.ts` (sets must stay 1:1 with English so the deterministic pick aligns).
- **Locale resolution (UI)**: `NEXT_LOCALE` cookie → `?lang=` (landing, via `LangQuerySync`) → `Accept-Language` (da→da) → `en`. See `lib/locale.ts`. No URL-prefix routing — don't add `/da/...` paths without revisiting `proxy.ts`.
- **Emails/SMS/push** render server-side via `getMessageTranslator(locale, "emails" | "sms")` in `lib/messages.ts`; recipient language = `resolveRecipientLocale(employee.locale, org.locale)` (falls back to English). Any new notification must resolve + pass `locale`.
- **Dates**: pass `LOCALE_TAGS[locale]` to `toLocaleDateString`/`formatWeekLabel`/`formatDayLabel` — never hardcode `"en-GB"` in user-facing output.
- **Still English (deliberate)**: legal pages, `/platform` superadmin pages, the deep manager components (grids/dialogs — follow-up), and the mobile app.

---

## Patterns to follow

- `serXxx()` helpers in `lib/serialize.ts` must be used before returning Prisma objects in API responses (converts `Decimal` → `number`, `Date` → ISO string).
- Route context params are `Promise<{ ... }>` in Next.js 16 — always `await params`.
- Never use `findFirst` without `orderBy` when duplicates might exist.
- `"use client"` is required on any component that imports from `lib/orgSettings.ts` (module singleton only exists client-side).
- When editing shared types, always edit `packages/types/src/index.ts` — not `apps/web/types/index.ts` (that's a re-export shim).
