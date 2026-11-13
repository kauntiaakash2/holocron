# Testing and evidence

## Executed in this workspace

- TypeScript strict check: passed.
- Next.js optimized production build: passed.
- Vitest: 39 tests (including ten native Holocron geometry/motion/renderer-lifecycle tests) covering shared validation, actual migration execution, database constraints, API/service integration, permissions, recovery, idempotency, admission state transitions, and ticket/security primitives.
- PNG: generated at 3200×1600, inspected visually, QR decoded with jsQR to the expected unique verification URL. Fixture saved at `output/playwright/ticket-fixture.png`; it is synthetic test artwork, not a real issued admission.
- PDF: generated, reopened with pdf-lib, verified as one landscape A4 page; fixture saved alongside PNG.
- Dependency installation audit: 0 vulnerabilities across 139 installed packages. A separate `npm audit --omit=dev` attempt was blocked by DNS restrictions; the subsequent lockfile reconciliation/install audit completed successfully.

## Scope of database/API evidence

Tests execute the actual SQL migration and queries in PGlite, a PostgreSQL WASM engine. API tests use the real route handler, business logic, cryptography, and SQL with the Drizzle PGlite connection adapter; Next cookie storage is replaced by an in-memory test jar. This validates SQL behavior and authorization branches but is **not** proof of native pg-driver concurrency, HTTP cookie transmission, or deployment behavior. The production application exclusively uses native PostgreSQL through pg/Drizzle; no test engine or mock responses are used in the application.

## Blocked verification

Native PostgreSQL initialized successfully but could not create its TCP socket (`Operation not permitted`, EPERM). Chromium also failed to launch with `setsockopt: Operation not permitted`. These sandbox restrictions prevented full browser and native PostgreSQL integration runs. No browser screenshots or WCAG compliance claim are made.

Consequently these remain unverified here:

- End-to-end mobile registration, keyboard behavior, refresh/retry behavior in a real browser
- Native PostgreSQL concurrent duplicate submissions and check-in/revocation races
- Actual cookie/header behavior through HTTPS ingress
- Responsive rendering at 320, 375, 390, 430, 768, 1024, 1440, and 1920px
- Intro skip, reduced-motion, reload/internal navigation behavior in browser
- Automated axe checks, manual screen-reader and keyboard audit
- Physical QR scan, print quality, production export load and latency
- Deployment backup restoration, gateway MFA, monitoring and TLS configuration

## Run the provided suites

`npm test` runs the network-independent tests. `npm run typecheck` and `npm run build` validate compilation.

Use a **disposable** native PostgreSQL database for Playwright. Migrate it, provision a synthetic administrator, and start Next with REGISTRATION_OPEN=true and POLICY_APPROVED=true. Set DATABASE_URL, TOKEN_SECRET, APP_ORIGIN, TEST_ORIGIN, TEST_ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD consistently for server/test runner. `tests/e2e/platform.spec.ts` deletes throttle rows before each test and creates synthetic registrations; never run it against live data.

Install a matching browser with `npx playwright install chromium` and run `npm run test:e2e`. An existing Chromium executable can be selected with PLAYWRIGHT_CHROMIUM_EXECUTABLE. Visual-only tests live in `tests/e2e/visual.spec.ts` and do not require a database. Captures are written to output/playwright. Runtime tests include registration races, duplicate check-in, private access denial, QR states, exports, mobile wizard, viewport overflow, preloader lifecycle and axe scans.

Manual release checks: test with screen reader and keyboard, zoom to 200%, disable motion, submit invalid field combinations, interrupt a request after commit, retry after refresh, scan a printed code, revoke during admission, verify all role restrictions, and load-test exports on production-equivalent hardware. Document results before checking the deployment launch boxes.

Native hero integration evidence and browser test commands are documented in [HOLOCRON_3D_INTEGRATION.md](HOLOCRON_3D_INTEGRATION.md). Chromium launch remains blocked in this environment; the new viewport and WebGL browser scenarios have not passed here.
