# Skemaka — Local Setup

Step-by-step provider setup. For an overview of the stack, scripts, and env vars,
see [README.md](./README.md). The canonical list of environment variables — with
inline notes — lives in [`apps/web/.env.example`](./apps/web/.env.example).

## Prerequisites

- Node.js 20.19+
- npm 10+ (ships with Node — this repo is an npm workspace; do not use pnpm/yarn)
- A Neon account (https://neon.tech)
- A Google Cloud account
- An Upstash account (https://upstash.com)
- A Stripe account (https://stripe.com)
- A Resend account (https://resend.com)
- A Twilio account (https://twilio.com)

---

## 1. Clone and install

```bash
git clone https://github.com/Gamborg0101/skemaka.git
cd skemaka
npm install
```

All scripts run from the repo root — you never need to `cd` into a workspace.

---

## 2. Set up Neon (database)

1. Go to https://neon.tech and create a new project.
2. In the project dashboard, open **Connection Details**.
3. Copy the **pooled connection string** — this is your `DATABASE_URL`.
4. Copy the **direct connection string** — this is your `DIRECT_URL`.

Both strings look like `postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`.
The pooled URL includes `?pgbouncer=true`; the direct URL does not. `DIRECT_URL`
is required for Prisma migrations.

---

## 3. Set up Google OAuth

1. Go to https://console.cloud.google.com and create (or select) a project.
2. Navigate to **APIs & Services → Credentials**.
3. Click **Create Credentials → OAuth client ID**.
4. Select **Web application**.
5. Add `http://localhost:3000/api/auth/callback/google` to **Authorized redirect URIs**.
6. Copy the **Client ID** (`AUTH_GOOGLE_ID`) and **Client Secret** (`AUTH_GOOGLE_SECRET`).

---

## 4. Set up Upstash Redis (rate limiting)

1. Go to https://console.upstash.com and create a new **Redis** database.
2. Select region closest to your Vercel deployment region.
3. From the database detail page, copy:
   - **REST URL** → `UPSTASH_REDIS_REST_URL`
   - **REST Token** → `UPSTASH_REDIS_REST_TOKEN`

---

## 5. Set up Stripe

1. Go to https://dashboard.stripe.com and create a product:
   - **Name:** Skemaka Subscription
   - **Pricing model:** Recurring, per unit
   - **Price:** €3.00 / active employee / month
2. Copy the **Price ID** (starts with `price_`) → `STRIPE_PRICE_ID`.
3. From **Developers → API keys**, copy:
   - **Secret key** → `STRIPE_SECRET_KEY`
   - **Publishable key** → `STRIPE_PUBLISHABLE_KEY`
4. From **Developers → Webhooks**, add an endpoint:
   - URL: `http://localhost:3000/api/webhooks/stripe` (use the Stripe CLI for local testing)
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

For local webhook testing, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 6. Set up Resend (email)

1. Go to https://resend.com and create an account.
2. Navigate to **API Keys** and create a new key → `RESEND_API_KEY`.
3. Navigate to **Domains** and add/verify your sending domain, then set `RESEND_FROM_EMAIL` to an address on that domain (e.g. `noreply@skemaka.com`).

For local development you can use `onboarding@resend.dev` as `RESEND_FROM_EMAIL` without domain verification (sends only to your Resend account email).

---

## 7. Set up Twilio (SMS)

Skemaka sends SMS notifications (roster published, time-off decisions) and handles
inbound STOP/START/HELP.

1. Go to https://console.twilio.com and copy:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN` (also used to verify the inbound SMS webhook)
2. Provision an SMS-capable phone number and set it as `TWILIO_FROM_NUMBER` (E.164, e.g. `+15551234567`).
3. For inbound STOP/START/HELP, point the number's **Messaging webhook** at
   `http://localhost:3000/api/webhooks/twilio` (use a tunnel like the Twilio CLI or ngrok for local testing).

---

## 8. Generate Web Push (VAPID) keys

Web push powers browser notifications for employees. Generate a key pair:

```bash
npx web-push generate-vapid-keys
```

Set:
- **Public key** → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- **Private key** → `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` → a `mailto:` address (e.g. `mailto:support@skemaka.com`)

---

## 9. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` and fill in the values from the steps above. Generate
`AUTH_SECRET` and `CRON_SECRET` with:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # CRON_SECRET
```

Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for local
dev, and `SUPERADMIN_EMAIL` to the owner email that should get ADMIN access and the
`/platform` panel. See `apps/web/.env.example` for the full list and inline notes.

---

## 10. Set up the database

From the repo root:

```bash
npm run db:push    # apply the Prisma schema to your Neon database
npm run db:seed    # seed demo data
```

`db:push` also generates the Prisma client. (Prefer `npm run db:migrate` if you want
a migration history locally — production applies schema via `db push`.)

---

## 11. Start the dev server

```bash
npm run dev:web    # Next.js web app  → http://localhost:3000
npm run dev:mobile # Expo mobile app (optional)
```

App runs at http://localhost:3000.
