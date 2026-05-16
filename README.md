# Skemaka

Staff scheduling SaaS for restaurants. Managers build weekly rosters, assign shifts, track labour costs, and manage time-off requests. Employees view their shifts and submit availability and time-off through a self-service portal.

---

## Features

- **Schedule builder** — drag-and-drop weekly timeline + grid view; 1/3/5/7-day range selector; published/draft state with SMS notifications
- **Employee management** — profiles, hourly wages, contracted hours, job roles, invite links
- **Time-off requests** — employees request leave; managers approve/deny with SMS notifications; approved days grey out in the schedule grid
- **Availability collection** — token-based forms sent by email; responses aggregated in a weekly grid
- **Labour cost report** — scheduled hours × wages; CSV payroll export
- **Onboarding wizard** — 3-step flow: workspace → team → done
- **Mobile-responsive** — bottom nav + per-day card view on phones; icon sidebar on tablets

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
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
| Deployment | Vercel |

---

## Getting started

### Prerequisites

- Node.js 20+
- A Neon database (or any Postgres instance)
- Accounts for: Resend, Twilio, Stripe, Upstash Redis (all optional for local dev with mocked calls)

### Local setup

```bash
git clone https://github.com/Gamborg0101/skemaka.git
cd skemaka
npm install

# Copy and fill in env vars
cp .env.example .env.local

# Push schema + seed demo data
npx prisma migrate deploy
npx prisma db seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
  dateUtils.ts        # getMondayOfWeek, addDays, getISOWeek
  validate.ts         # Input validation helpers
  orgContext.tsx      # OrgProvider + useOrg() hook
  prisma.ts           # Prisma client (Neon adapter, 30 s timeout)

prisma/
  schema.prisma       # Database schema
  seed.ts             # Demo seed data
```

---

## Scripts

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npm run test       # Vitest (run once)
npm run test:watch # Vitest (watch mode)
```

---

## Deployment

Designed for Vercel + Neon. Set all env vars in the Vercel dashboard, then:

```bash
vercel deploy --prod
```

Prisma migrations run via `prisma migrate deploy` in the build command or a pre-deploy script.

---

## Status

This project is pre-launch. See [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) for a full list of known blockers and open issues before taking paying customers.

---

## Licence

Private — all rights reserved.
