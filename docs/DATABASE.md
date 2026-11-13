# Database

Authoritative schema: `migrations/001_initial.sql`. `scripts/migrate.ts` runs once under a transaction and advisory lock; applied versions are recorded. Never modify an applied migration in production: add a numbered migration and extend the runner.

- teams: UUID primary identity, random public ID, normalized name, status, credential hash, idempotency hash, payload hash, timestamps.
- participants: positions 0–2, leader iff position 0, eligibility year 1–3, contact data, active membership. Deferred constraint triggers require three members per team at commit.
- registration_consents: six declarations, policy versions, timestamp.
- tickets: one per team, hashed verification token, issued/revoked times and state.
- admin_users/admin_sessions: scrypt password digests, role, active status; hashed expiring session tokens.
- check_ins: unique ticket ID, organizer actor, timestamp.
- registration_audit_events: no participant payloads, action and actor IDs.
- rate_limits: atomic fixed-window counters shared by all instances.

Partial unique indexes cover normalized team name, roll, and email for active registrations. Name normalization: NFKC, trim, whitespace collapse, lowercase. Email: trim and lowercase; roll: trim and uppercase. Revocation atomically releases participant constraints and the team name. Revoked tickets remain revoked; new registrations receive new IDs. No self-service cancellation is exposed.

A roster deletion without team deletion fails the deferred constraint. Retention deletion must delete check_ins first, then teams (cascading private records); audit team references become null. Preserve or anonymize actor audit records according to approved policy. Backup retention must match the published privacy policy.
