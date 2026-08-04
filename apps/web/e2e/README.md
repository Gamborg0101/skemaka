# Browser E2E (Playwright)

The money path: access control, the trial paywall, invite claim, roll-out, the
employee limit, and payroll export.

## ⚠️ Never run these against `.env.local`

`apps/web/.env.local` points `DATABASE_URL` at **production**. These specs create
and delete rows, and `playwright.config.ts` starts its own dev server that
inherits the ambient environment. Always pass an explicit local `DATABASE_URL`.

Next.js does not override variables already present in the environment, so an
exported `DATABASE_URL` wins over `.env.local` — but verify rather than trust it:
sign in once and confirm the rows landed in your local database.

## Running locally

The app always uses the Neon serverless driver, which speaks WebSockets, so a
plain Postgres needs `wsproxy` in front of it. Setup is the same as for the
integration suite (see `test/integration-setup.ts`).

```bash
# 1. Postgres + wsproxy (Docker-free path)
brew install postgresql@16 go && brew services start postgresql@16
go install github.com/neondatabase/wsproxy@latest
LISTEN_PORT=:5433 APPEND_PORT=localhost:5432 ALLOW_ADDR_REGEX='.*' ~/go/bin/wsproxy &

# 2. A throwaway database with the schema
createdb skemaka_e2e
cd apps/web
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skemaka_e2e"
export NEON_WS_PROXY="localhost:5433/v1"
npx prisma migrate deploy

# 3. Fixtures — the specs sign in as seeded users and fail at login without this
export E2E_TEST_PASSWORD="e2e-secret"
npm run seed:e2e

# 4. A server with the e2e credentials provider enabled.
#    Next 16 refuses a second dev server for the same directory, so stop any
#    `npm run dev:web` first.
E2E_TEST_LOGIN=1 NEXTAUTH_URL=http://localhost:3100 \
  npx next dev -p 3100 &

# 5. The specs
npx playwright install chromium   # first run only
E2E_BASE_URL="http://localhost:3100" npx playwright test --reporter=list
```

`E2E_BASE_URL` makes Playwright use the server you started instead of spawning
its own — which is what keeps the database under your control.

## Fixtures

`e2e/fixtures.ts` holds the shared identifiers and is deliberately
side-effect-free; `prisma/seed-e2e.ts` creates the rows. Both import the same
constants so they cannot drift.

The dataset covers three orgs — active, expired-trial, and a second tenant — so
the specs can assert 402 for an expired trial and 403 across tenants without
inventing state per test.

## The e2e credentials provider

`lib/auth.ts` registers it only when `E2E_TEST_LOGIN === "1"`, and it requires a
shared `E2E_TEST_PASSWORD`. It is a password backdoor by design: never enable it
on a server whose `DATABASE_URL` points anywhere real.
