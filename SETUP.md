# Skemaka — Local Setup

## Prerequisites

- Node.js 20+
- npm 10+
- A Neon account (https://neon.tech)
- A Google Cloud account
- An Upstash account (https://upstash.com)
- A Stripe account (https://stripe.com)
- A Resend account (https://resend.com)

---

## 1. Clone and install

```bash
git clone <repo-url>
cd skemaka
npm install
```

---

## 2. Set up Neon (database)

1. Go to https://neon.tech and create a new project.
2. In the project dashboard, open **Connection Details**.
3. Copy the **pooled connection string** — this is your `DATABASE_URL`.
4. Copy the **direct connection string** — this is your `DIRECT_URL`.

Both strings look like `postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`.
The pooled URL includes `?pgbouncer=true`; the direct URL does not.

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
   - **Price:** €3.00 / month
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

## 7. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all values. Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

---

## 8. Run database migrations

```bash
npm run db:migrate
```

This applies the schema to your Neon database and generates the Prisma client.

---

## 9. Start the dev server

```bash
npm run dev:web
```

App runs at http://localhost:3000.
