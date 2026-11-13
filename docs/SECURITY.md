# Security

Implemented controls: shared Zod plus server domain validation, parameterized Drizzle SQL, deferred roster constraints, partial active uniqueness indexes, transactional registration, idempotency, opaque access credentials, hashed ticket/session lookup tokens, scrypt organizer passwords, role enforcement, exact-origin CSRF checks, strict HTTP-only cookies (Secure in production), shared PostgreSQL throttling, honeypot, bounded request bodies, safe React/SVG escaping, formula-safe CSV quoting, private no-store responses, audit actions, and security headers.

Deployment requires HTTPS, a secret manager, a restricted database account, TLS for remote PostgreSQL, proxy rate limits, and appropriate backups. TRUST_PROXY must only be enabled if the ingress overwrites X-Forwarded-For. Otherwise throttling intentionally uses a shared bucket and is unsuitable for a large live event. Never trust an attacker-provided forwarded address.

Residual risks and limits:

- Organizer login uses strong provisioned passwords but has no MFA or SSO. Add an identity-aware gateway with MFA before a public event.
- CSP permits inline scripts/styles for Next.js hydration. It blocks foreign sources, framing, objects, and unsafe form targets, but is not a nonce-based strict CSP. Do not claim full XSS containment.
- Recovery is possession-based. Lost recovery keys require verified organizer assistance; there is no automated email reset. Stolen keys expose the team's private registration.
- Honeypot and throttling reduce basic abuse but do not defeat targeted bots. Add an edge challenge if abuse is observed; avoid making inaccessible challenges the only recovery path.
- Enrollment checking is a human workflow. Approval must be based on university records/ID, not email possession.
- Rate limits use database writes. Protect origin availability at the ingress and load-test ticket rendering.
- No application monitoring vendor is configured. Logs intentionally avoid request bodies/tokens; deploy monitoring with path redaction for QR token routes and PII scrubbing.
- No security guarantee or complete penetration test is claimed.

Dependency review: run `npm audit --omit=dev` and `npm audit`; remediate runtime critical/high findings before release. See TESTING for actual executed results.

Operational policy: proposed 90-day post-event PII retention requires organizer approval. Publish a verified rights-request/contact channel, document retention exceptions, backups, and deletion ownership before opening registration. These are deployment gates, not fabricated event facts.
