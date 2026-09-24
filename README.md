# ShineOps

**Client retention & operations for recurring cleaning businesses.**

Residential cleaning companies live on weekly and biweekly clients, and most cancellations come from quality problems the owner never hears about until it's too late: *"different cleaner every time," "they missed the baseboards again."* ShineOps collects feedback from every channel, scores each client's health, tells the owner exactly who is at risk and what to do about it, and turns that into a task someone owns.

## What it does

| Area | Features |
|---|---|
| **Owner dashboard** | Recurring revenue, revenue at risk, 30-day rating trend, visits this week, clients needing attention, cleaner scorecard |
| **Client health** | Scores every client 0–100 (Healthy / At risk / Critical) from ratings, rating trend, complaint themes, skipped visits and cleaner consistency. With an Anthropic API key, Claude reads the client's actual feedback and writes the summary, reasons and a specific recommended action; otherwise a deterministic rules engine does it |
| **Task queue** | Health alerts automatically become follow-up tasks (one open task per client, updated as things change), alongside client requests and manual tasks |
| **Clients** | Full CRUD, search and filters, recurring plans (weekly / biweekly / monthly), preferred cleaner, pause / cancel / reactivate |
| **Schedule** | Generates visits from recurring plans (idempotent), assign cleaners per visit |
| **Cleaner app** | "My day": addresses, entry instructions, pets, a heads-up if the client's last rating was low, mark complete or report a problem |
| **Client portal** | Clients see upcoming cleans, rate each visit, and send requests (reschedule, deep clean, pause) |
| **Team & roles** | Owner / Manager / Cleaner / Client, with invites, role changes and deactivation |
| **Platform admin** | Operator console across all companies: companies with revenue and at-risk counts, onboard a new company with its first owner, search every user, add users to any company, change roles, reset passwords, deactivate. Every company always keeps at least one active owner |
| **Integrations** | Feedback webhook that accepts three payload formats (native, review-platform events, NPS surveys), normalizes them, de-duplicates by external id, and re-scores health immediately |

## Tech stack & architecture

```
Browser ──► Next.js 16 (App Router, React 19 Server Components)
              ├─ Server Actions: all app mutations, each starting with a role check
              ├─ Route Handler: POST /api/webhooks/feedback (secret-authenticated)
              ├─ lib/health: signals → rules engine | Claude (structured output) → assessment → task sync
              └─ Drizzle ORM ──► PostgreSQL (Supabase in production)
                                   Anthropic API (Claude) for health analysis
```

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, lucide icons
- **Backend:** Next.js Server Actions + Route Handlers
- **Database:** PostgreSQL via Drizzle ORM (typed schema, SQL migrations in `drizzle/`)
- **Auth:** email + password (bcrypt), signed HTTP-only JWT session cookie (jose). The user is re-loaded from the database on every request, so deactivation and role changes apply immediately
- **Multi-tenancy:** every row carries `company_id`; every query and mutation is scoped to the signed-in user's company, and ids from forms (cleaners, clients) are verified to belong to that company. Platform admins are the only users without a company (enforced by a database check constraint) and have their own guard (`requireAdmin`), separate from company pages (`requireRole`)
- **AI:** Anthropic SDK, structured outputs validated with Zod, with an automatic fallback to the rules engine if the key is missing or a call fails
- **Tests:** Vitest unit tests for schedule math, health scoring and webhook normalization
- **Hosting:** Vercel + Supabase

### Project layout

```
src/
  app/(app)/        staff & cleaner pages: dashboard, clients, schedule, tasks, team, settings, today
  app/portal/       client portal
  app/admin/        platform admin console (companies, all users)
  app/api/webhooks/ inbound feedback webhook
  db/schema.ts      database schema
  lib/actions/      server actions (clients, visits, tasks, team, portal, health)
  lib/health/       signals.ts (feature extraction), rules.ts (scorer), ai.ts (Claude), service.ts (orchestration)
  lib/webhooks/     payload normalization
scripts/            migrate + seed
tests/              unit tests
```

## Running locally

Requires Node 20+ and PostgreSQL.

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and SESSION_SECRET
npm run db:migrate            # create tables
npm run db:seed               # demo company (WARNING: wipes existing data)
npm run dev                   # http://localhost:3000
```

Demo logins (password `demo1234`):

| Role | Email |
|---|---|
| Platform admin | `admin@shineops.demo` |
| Owner | `owner@sparkleco.demo` (a second company: `owner@freshnest.demo`) |
| Manager | `manager@sparkleco.demo` |
| Cleaner | `maria@sparkleco.demo` |
| Client portal | `hannah.lee@example.com` |

```bash
npm test           # unit tests
npm run typecheck
npm run lint
```

## Deploying (Vercel + Supabase)

1. Create a Supabase project and copy the **Transaction pooler** connection string.
2. From your machine, run `DATABASE_URL="<supabase url>" npm run db:migrate` and then `npm run db:seed` the same way.
3. Import the GitHub repo in Vercel and set the `DATABASE_URL`, `SESSION_SECRET` and (optionally) `ANTHROPIC_API_KEY` environment variables. Then deploy.

## Webhook example

```bash
curl -X POST https://<your-app>/api/webhooks/feedback \
  -H "Content-Type: application/json" \
  -H "X-ShineOps-Secret: <company secret from the Integrations page>" \
  -d '{"client_email":"robert.chen@example.com","rating":2,"comment":"Kitchen floor was still sticky"}'
```

Responses: `201` created (includes the updated health score), `200` duplicate, `401` bad secret, `404` unknown client, `422` unrecognized payload.
