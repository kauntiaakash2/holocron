# HOL0CRON — The Forbidden Archive

A Next.js application with PostgreSQL-backed three-person registration, a cinematic SVG identity, private team recovery, collectible PNG/PDF tickets, public privacy-preserving verification, and role-based organizer operations.

## Run locally

Node 22+ and PostgreSQL 16+ recommended. Install dependencies with `npm ci`. Copy `.env.example` to `.env.local`, generate `TOKEN_SECRET` with `openssl rand -hex 32`, and set `DATABASE_URL` and `APP_ORIGIN`.

```sh
npm run db:local # optional, separate terminal; real local PostgreSQL, development only
node --env-file=.env.local --import tsx scripts/migrate.ts
npm run dev
```

Registration is deliberately closed by default. Confirm email domains and approve the displayed participation/privacy policies, then set `REGISTRATION_OPEN=true` and `POLICY_APPROVED=true`. In development these flags may be enabled for testing with synthetic data. Server environment changes require restart.

Create organizer accounts through the trusted CLI, never a public signup endpoint:

```sh
# Set ADMIN_INITIAL_PASSWORD securely in your shell (16+ characters).
node --env-file=.env.local --import tsx scripts/create-admin.ts organizer@example.org admin
```

Roles: `admin`, `reviewer`, `checkin`. No shared default credentials. Visit `/admin`.

```sh
npm run typecheck
npm test
npm run build
# Against a running server and a disposable test database:
node --env-file=.env.test --import tsx node_modules/@playwright/test/cli.js test
```

Read [deployment](docs/DEPLOYMENT.md), [testing](docs/TESTING.md), [API](docs/API.md), and [security](docs/SECURITY.md) before launch. Never point integration tests at the live database.

## Event facts and outstanding configuration

22 December 2026; Campus 25, Lecture Halls, KIIT University, Bhubaneswar. KIIT undergraduate years 1–3; exactly three members. Hours, fees, prizes, deadlines, sponsors, and contact addresses are not invented. Timing is controlled by `EVENT_TIME_LABEL`. Organizer names are rendered as text rather than inaccurate logo substitutes. Official logo assets and approved contact details remain organizer inputs.

The preloader uses the user-supplied recording of the Dribbble animation, inspected locally and trimmed to the cockpit approach with a glass-mask zoom into the live landing page. Its optimized media is self-hosted in `public/media`. The landing-page emblem and ticket geometry are original; the ticket reference remains based on the supplied creative description.

The homepage now includes the native interactive Holocron from `holocron-web.zip`. See [3D integration and validation](docs/HOLOCRON_3D_INTEGRATION.md) for architecture, fallback regeneration, accessibility, performance controls and remaining browser checks.
