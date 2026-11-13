# Deployment

1. Provision Node 22+ compute supporting sharp native binaries and persistent managed PostgreSQL. Use a build that retains public/fonts and installed fontsource assets.
2. Install from lockfile with npm ci. Supply DATABASE_URL with verified TLS, APP_ORIGIN (canonical HTTPS origin), a 32+ character random TOKEN_SECRET, confirmed KIIT_EMAIL_DOMAINS, EVENT_TIME_LABEL if known. Keep REGISTRATION_OPEN=false.
3. Run migrations with a separate migration role. Application role needs SELECT/INSERT/UPDATE/DELETE on application tables, not DDL, schema ownership, or superuser access. Test backup restoration before live use.
4. Run typecheck, unit tests, production build, and API/browser integration tests against a separate disposable test database. Then `npm start -- --hostname 0.0.0.0 --port 3000` behind TLS ingress.
5. Provision individual organizers using the CLI; use reviewer/checkin roles wherever possible. Place admin routes behind MFA-enabled identity-aware access. Disable users and delete their sessions on offboarding.
6. Configure a proxy that replaces X-Forwarded-For before enabling TRUST_PROXY. Apply ingress body and traffic limits. Restrict DB network access to application/migration services.
7. Confirm email domains, eligibility-review process, official assets, event hours, privacy retention, and verified contact details. Update policy pages to approved language and bump policy versions when substance changes. Set POLICY_APPROVED=true and REGISTRATION_OPEN=true only then.
8. Monitor failed requests, DB pool saturation, export memory, and admission conflicts without recording PII or QR secrets. Redact /verify/* and /api/tickets/verify/* paths in access logs and monitoring.

## Operations

Back up PostgreSQL daily with point-in-time recovery; encrypt backups and test restoration. Define an organizer-approved RPO/RTO. Before changing TOKEN_SECRET, plan reissuance: existing verification hashes will not match regenerated tokens, and recovery cookies derived from the old secret become invalid. Never casually rotate it during admission.

Prune expired admin_sessions and rate_limits daily. Revoke via dashboard; it atomically invalidates tickets and frees active identities. Corrections currently require organizer verification and revocation/re-registration; there is no unsafe silent roster editor.

For rollback, deploy the prior application only if compatible with the current additive schema. Restore databases only under incident procedures; do not erase registrations with a casual rollback.

## Launch checklist

- [ ] Approved event time/email domains/contact channel and policies published
- [ ] Production PostgreSQL, least-privilege app role, TLS, backup restore tested
- [ ] Secrets provisioned; MFA gateway and individual organizer accounts configured
- [ ] Rate-limit proxy trust verified; origin matches canonical domain
- [ ] Migration, build, tests, dependency audit run on deployment artifact
- [ ] Real phone QR scan and printed ticket tested
- [ ] Production concurrency/load, accessibility and browser checks completed
- [ ] Monitoring, redaction, incident response, and retention owners assigned
- [ ] Registration and policy approval flags deliberately enabled

The provided Dockerfile supplies DejaVu system fonts for deterministic Sharp rasterization. Run migrations as a separate trusted job from the source checkout; the runtime container intentionally excludes development scripts/dependencies. The compose file provides only a local development PostgreSQL instance, not a hardened production stack.

`node --env-file=.env.local --import tsx scripts/retention.ts` reports records eligible under RETENTION_CUTOFF after the proposed post-event retention window. It is dry-run by default; `--execute` applies the organizer-reviewed deletion only when POLICY_APPROVED=true. Resolve legal/incident holds before running it, and apply backup expiration separately.
