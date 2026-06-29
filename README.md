# Skemaka

Staff scheduling SaaS for restaurants. Managers build weekly rosters, assign shifts, track labour costs, and manage time-off requests. Employees view their shifts and submit availability and time-off through a self-service portal.

---

## Features

- **Schedule builder** — drag-and-drop weekly timeline + grid view; 1/3/5/7-day range selector; published/draft state with SMS notifications. Editing, adding, or deleting a shift on a published roster returns it to draft, so changes are deliberately re-published (and re-notified) rather than going out silently.
- **Employee management** — profiles, hourly wages, contracted hours, job roles, invite links
- **Time-off requests** — employees request leave; managers approve/deny with SMS notifications; approved days grey out in the schedule grid
- **Availability collection** — token-based forms sent by email; responses aggregated in a weekly grid
- **Labour cost report** — scheduled hours × wages, with overnight shifts counted correctly; CSV payroll export
- **Onboarding wizard** — 3-step flow: workspace → team → done
- **Native mobile app** — Expo / React Native app for employees (and managers on the go), sharing types and API hooks with the web app
- **Mobile-responsive web** — bottom nav + per-day card view on phones; icon sidebar on tablets

---

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Web framework | Next.js 16 (App Router) |
| Mobile | Expo / React Native + NativeWind |
| Language | TypeScript |
| Database | Neon PostgreSQL (serverless) |
| ORM | Prisma 7 |
| Auth | NextAuth 5 beta — JWT strategy |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Drag-and-drop | dnd-kit |
| Email | Resend |
| SMS | Twilio |
| Billing | Stripe |
| Rate limiting | Upstash Redis |
| Tests | Vitest |
| Deployment | Vercel (web) |

---

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 10+ (this repo is a pnpm workspace — npm/yarn will not resolve the internal packages)
- A Neon database (or any Postgres instance)
- Accounts for: Resend, Twilio, Stripe, Upstash Redis (all optional for local dev with mocked calls)

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

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon / Postgres connection string |
| `NEXTAUTH_SECRET` | Random 32-byte secret for JWT signing |
| `NEXTAUTH_URL` | Base URL of the app (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `RESEND_API_KEY` | Resend API key for email |
| `RESEND_FROM` | Sender address (e.g. `noreply@yourdomain.com`) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (E.164 format) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe price ID for the subscription plan |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

---

## Project structure

This is a Turborepo + pnpm monorepo:

```
apps/
  web/                # Next.js 16 web app (managers + employee portal)
  mobile/             # Expo / React Native app

packages/
  types/              # @skemaka/types — shared TypeScript interfaces
  api/                # @skemaka/api   — ApiClient + TanStack Query hooks
  ui/                 # @skemaka/ui    — shared design tokens + cn()
```

Inside `apps/web/`:

```
app/
  (manager)/          # Manager-facing pages (schedule, employees, costs, time-off, …)
  (employee)/         # Employee portal + availability token pages
  (onboarding)/       # 3-step onboarding wizard
  api/                # API routes
    orgs/[orgId]/     # Org-scoped endpoints (schedules, employees, time-off, costs, …)
    me/               # Current-user context
    availability/     # Token-based availability (public)
    webhooks/         # Stripe webhook

components/
  manager/            # All manager UI components
  ui/                 # shadcn/ui primitives

lib/
  auth.ts             # NextAuth config + JWT callback
  apiGuard.ts         # requireOrgMember() — fast JWT check + DB fallback
  serialize.ts        # Prisma → plain-object helpers
  sms.ts              # Twilio wrappers
  dateUtils.ts        # getMondayOfWeek, addDays, getISOWeek, grossShiftMinutes
  validate.ts         # Input validation helpers
  orgContext.tsx      # OrgProvider + useOrg() hook
  prisma.ts           # Prisma client (Neon adapter, 30 s timeout)
  services/           # Domain logic (scheduleService, employeeService, …)

prisma/
  schema.prisma       # Database schema
  seed.ts             # Demo seed data
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
pnpm start         # Start the production Next.js server
pnpm test:watch    # Vitest (watch mode)
pnpm screenshots   # Regenerate UI screenshots
```

---

## Deployment

The **web app** is designed for Vercel + Neon. Set all env vars in the Vercel dashboard, point the project at `apps/web`, then:

```bash
vercel deploy --prod
```

Prisma migrations run via `prisma migrate deploy` in the build command or a pre-deploy script. The **mobile app** is built and released separately through Expo.

---

## Status

This project is pre-launch. See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) for a full list of known blockers and open issues before taking paying customers.

---

## Licence

Private — all rights reserved.
