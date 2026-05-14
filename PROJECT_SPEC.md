# Skemaka — Project Specification

## What We're Building

A staff scheduling SaaS for small hospitality businesses (cafés, restaurants, bakeries, retail).
Managers create weekly schedules fast. Employees manage their shifts from their phones.
Monetized via Stripe at €3/employee/month.

---

## The Three Areas

| Area | Users | Device |
|---|---|---|
| Manager dashboard | Business owners / managers | Web + tablet |
| Employee portal | Staff | Mobile-first web |
| Admin panel | Product owner (you) | Web |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Auth | Auth.js |
| Rate limiting | Upstash |
| Payments | Stripe |
| Email | Resend |
| Deployment | Vercel |

---

## Authentication

| Role | Method |
|---|---|
| Managers | Google OAuth (Google handles passwords) |
| Employees | Magic link via Resend (no password, no account setup) |
| Admin | Google OAuth (restricted to owner email) |

Employees are invited by managers. Resend sends the invite email with a magic link.
On click, the employee is authenticated and lands directly in their portal.

---

## Pricing

- **€3 per active employee per month**
- Stripe subscription with quantity = number of active employees
- When a manager adds or removes an employee, the Stripe subscription quantity updates automatically
- Free trial period: TBD

---

## MVP Feature Scope

### Manager Dashboard

- Weekly schedule view (horizontal calendar, drag & drop shifts)
- Employee management (add, edit, remove employees)
- Trigger availability collection (sends Resend email to all employees)
- See submitted availability in a clean grid before scheduling
- Shift management: create, edit, delete, duplicate previous week
- Labor cost tracker: hours × wage shown per employee, per week, total
- Stripe-gated access (must have active subscription)

### Employee Portal (mobile-first)

- View upcoming shifts
- Submit availability via magic link email
- No password required — magic link each time

### Admin Panel (owner only)

- View all registered businesses
- View subscription status per business
- View employee count per business
- Manually adjust or inspect subscriptions

---

## Data Collection Strategy

Collect everything from day one to power AI scheduling in Phase 2:

- Every schedule created, edited, duplicated
- Every shift (date, start/end time, role, employee, break)
- Availability submissions per employee per week
- Labor cost per week per business
- Accepted / rejected schedule changes

---

## What Is NOT in MVP

- AI scheduling suggestions (Phase 2 — needs real data first)
- Store-specific learning (Phase 2)
- Shift swap requests between employees
- Push / SMS notifications
- Scheduling rule engine (max hours, rest time, etc.)
- Native mobile app
- POS, inventory, reservations, payroll

---

## Phase 2 (Post-MVP)

- AI scheduling suggestions based on collected history
- Store-specific learning (peak hours, preferred employee combos)
- Shift swap requests
- Scheduling rules engine
- Email/push notifications

---

## Multi-Tenant Model

- Each business is an **Organization**
- Users belong to one or more organizations with a role: `MANAGER` or `EMPLOYEE`
- Stripe subscription is tied to the Organization
- Admin panel is restricted to a hardcoded owner email

---

## MVP Goal

> "Create and manage a full staff schedule in under 10 minutes."
