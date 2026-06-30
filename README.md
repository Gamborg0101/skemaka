# Skemaka

Staff scheduling SaaS for restaurants, cafés, and other small hospitality businesses. Managers build weekly rosters, assign shifts, track labour costs, and handle time-off and availability. Employees view their shifts, clock in and out, and submit availability and time-off — from the web portal or the native mobile app.

One organization per business. Each member has a role: `MANAGER` (or `ADMIN`) or `EMPLOYEE`. Billed at **€3 per active employee per month** via Stripe.

---

## Features

### Scheduling
- **Schedule builder** — drag-and-drop weekly timeline + grid view, with a 1/3/5/7-day range selector. 15-minute snap when dropping shifts.
- **Draft / published state** — publishing a roster notifies staff by SMS. Editing, adding, or deleting a shift on a published roster returns it to draft, so changes are deliberately re-published (and re-notified) rather than going out silently.
- **Auto-generate** — seed a week from submitted availability and shift templates.
- **Shift templates & job roles** — reusable shift presets and per-org roles to speed up roster building.

### Team & time
- **Employee management** — profiles, hourly wages, contracted hours, employment type, job roles, and invite links.
- **Time tracking** — employees clock in/out; managers review and edit time entries. Feeds the labour cost report and payroll export.
- **Time-off requests** — employees request leave; managers approve/deny with SMS notifications; approved days grey out in the schedule grid.
- **Availability collection** — token-based forms sent by email; responses aggregated in a weekly grid for scheduling.
- **Labour cost report** — scheduled hours × wages, with overnight shifts counted correctly; CSV payroll export.

### Accounts & access
- **Onboarding wizard** — 3-step flow: workspace → team → done.
- **Manager sign-in** — Google OAuth.
- **Employee invites** — managers invite by email; employees claim an invite with an emailed OTP code.
- **Native mobile app** — Expo / React Native app for employees (and managers on the go) with email and Apple Sign-In, sharing types and API hooks with the web app.
- **Mobile-responsive web** — bottom nav + per-day card view on phones; icon sidebar on tablets.
- **Platform admin panel** — owner-only view of all orgs, subscriptions, and surfaced errors (gated by `SUPERADMIN_EMAIL`).

### Billing & compliance
- **Stripe subscriptions** — checkout + customer portal; webhook-driven, with idempotent event processing.
- **SMS compliance** — inbound STOP/START/HELP handling via a Twilio webhook, with a per-number opt-out list.
- **Rate limiting** — Upstash Redis on sensitive endpoints.
- **Bug reports** — in-app reporting with a daily email digest.
- **Legal pages** — privacy policy, terms, and subprocessors.

---

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Web framework | Next.js 16 (App Router) |
| Mobile | Expo 54 / React Native + NativeWind + expo-router |
| Language | TypeScript |
| Database | Neon PostgreSQL (serverless) |
| ORM | Prisma 7 (Neon adapter) |
| Auth | NextAuth 5 beta — JWT strategy (Google OAuth + mobile bearer tokens) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Drag-and-drop | dnd-kit |
| Data fetching (mobile) | TanStack Query |
| Email | Resend |
| SMS | Twilio |
| Billing | Stripe |
| Rate limiting | Upstash Redis |
| Tests | Vitest (unit) + Playwright (e2e) |
| Deployment | Vercel (web, incl. cron) + Expo/EAS (mobile) |

---

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 10+ (this repo is a pnpm workspace — npm/yarn will not resolve the internal packages)
- A Neon database (or any Postgres instance)
- Accounts for: Google Cloud (OAuth), Resend, Twilio, Stripe, Upstash Redis

See [SETUP.md](./SETUP.md) for step-by-step provider setup.

### Local setup

```bash
git clone https://github.com/Gamborg0101/skemaka.git
cd skemaka
pnpm install

# Copy and fill in env vars (the web app reads from apps/web/.env.local)
cp apps/web/.env.example apps/web/.env.local

# Push schema + seed demo data (Prisma always runs from apps/web)
cd apps/web
npx prisma db push
npx prisma db seed
cd ../..

# Start the web dev server (Next.js)
pnpm dev:web

# …or the mobile dev server (Expo)
pnpm dev:mobile
```

The web app runs at [http://localhost:3000](http://localhost:3000). `pnpm dev` starts every app via Turborepo.

### Environment variables

All web env vars live in `apps/web/.env.local` (see `apps/web/.env.example`).

| Variable | Description |
|---|---|
| `DATABASE_URL` | Pooled Neon / Postgres connection string (used at runtime) |
| `DIRECT_URL` | Direct (non-pooled) connection string — required for Prisma migrations |
| `AUTH_SECRET` | Random secret for signing session tokens (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `NEXTAUTH_URL` | Canonical URL used for Auth.js callbacks (e.g. `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe price ID for the €3/employee/month plan |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `RESEND_API_KEY` | Resend API key for email |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `noreply@skemaka.com`) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (also verifies the inbound SMS webhook) |
| `TWILIO_FROM_NUMBER` | Twilio sending number (E.164 format) |
| `NEXT_PUBLIC_APP_URL` | Public-facing URL used for links in emails |
| `SUPERADMIN_EMAIL` | Owner email — grants ADMIN role, gates `/platform`, receives bug reports |
| `MOBILE_TOKEN_MAX_AGE` | Mobile session token lifetime in seconds (default `1800`) |
| `CRON_SECRET` | Bearer token required by the scheduled cron endpoints |

---

## Project structure

This is a Turborepo + pnpm monorepo:

```
apps/
  web/                # Next.js 16 web app (managers + employee portal + platform admin)
  mobile/             # Expo / React Native app

packages/
  types/              # @skemaka/types — shared TypeScript interfaces
  api/                # @skemaka/api   — ApiClient + TanStack Query hooks
  ui/                 # @skemaka/ui    — shared design tokens + cn()
```

Inside `apps/web/`:

```
app/
  (auth)/             # Login
  (onboarding)/       # 3-step onboarding wizard
  (manager)/          # Manager pages: schedule, employees, costs, time-off,
                      #   availability, billing, settings, my-shifts
  (employee)/         # Employee portal + token-based availability pages
  (platform)/         # Owner-only admin panel (orgs, errors)
  (legal)/            # Privacy, terms, subprocessors
  api/
    orgs/[orgId]/     # Org-scoped endpoints (schedules, shifts, employees,
                      #   time-off, time-entries, costs, roles, templates, billing…)
    me/               # Current-user context, account, invite claim
    auth/             # NextAuth + mobile bearer-token + Apple-native auth
    availability/     # Token-based availability (public)
    platform/         # Admin endpoints (orgs, errors)
    webhooks/         # Stripe + Twilio inbound SMS
    cron/             # cleanup, bug-report-digest (Vercel Cron)

components/
  manager/            # Manager UI (incl. ShiftTimeline drag-and-drop)
  ui/                 # shadcn/ui primitives

lib/
  auth.ts             # NextAuth config + JWT callback (id, role, orgId)
  apiGuard.ts         # requireOrgMember() — fast JWT check + DB fallback
  serialize.ts        # Prisma → plain-object helpers (Decimal → number, Date → ISO)
  services/           # Domain logic (schedule, employee, availability, clock,
                      #   timeOff, billing, org)
  orgContext.tsx      # OrgProvider + useOrg() hook
  prisma.ts           # Prisma client (Neon adapter, 30 s timeout)
  sms.ts / resend.ts  # Twilio + Resend wrappers
  stripe.ts / billing.ts / pricing.ts
  dateUtils.ts        # getMondayOfWeek, addDays, getISOWeek, …

prisma/
  schema.prisma       # Database schema
  seed.ts             # Demo seed data
```

Inside `apps/mobile/` (expo-router):

```
app/
  (auth)/login        # Email + Apple Sign-In
  (tabs)/             # shifts, availability, requests, team, profile, settings
store/                # Zustand auth store (expo-secure-store)
lib/, hooks/, components/
```

---

## Scripts

Run from the repo root — Turborepo fans these out across the workspace:

```bash
pnpm dev           # Start all dev servers
pnpm dev:web       # Web only (Next.js)
pnpm dev:mobile    # Mobile only (Expo)
pnpm build         # Production build (all apps)
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit across every package
pnpm test          # Vitest (run once)
```

App-specific scripts live in each package — e.g. from `apps/web/`:

```bash
pnpm start            # Start the production Next.js server
pnpm test:watch       # Vitest (watch mode)
pnpm test:e2e         # Playwright end-to-end tests
pnpm seed:e2e         # Seed the e2e test fixtures
pnpm screenshots      # Regenerate UI screenshots
```

---

## Deployment

The **web app** runs on Vercel + Neon. Point the Vercel project at `apps/web`, set all env vars in the dashboard, and deploy:

```bash
vercel deploy --prod
```

- The build runs `prisma generate && next build`. Run `prisma migrate deploy` (or `prisma db push`) against the production database as part of release.
- Two cron jobs are configured in `apps/web/vercel.json`: weekly `cleanup` and a daily `bug-report-digest`. Both require the `CRON_SECRET` bearer token.

The **mobile app** is built and released separately through Expo / EAS — see [apps/mobile/APP_STORE_SUBMISSION.md](./apps/mobile/APP_STORE_SUBMISSION.md).

See [GO_LIVE_RUNBOOK.md](./GO_LIVE_RUNBOOK.md) and [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) before taking paying customers.

---

## Licence

Private — all rights reserved.
