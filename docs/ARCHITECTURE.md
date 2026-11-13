# Architecture

Next.js App Router serves the editorial landing page and thin route shells. Interactive wizard and organizer components are client islands. React Hook Form owns wizard state; Zod validates the shared input contract, with final domain validation on the server. CSS and SVG own motion; no animation runtime is needed.

`app/api/[...path]/route.ts` is a centralized HTTP adapter. `lib/registrations.ts` owns transactional registration and access checks; `lib/security.ts` owns identity, throttling, and request protection; `lib/tickets.ts` produces exports. Drizzle's SQL template binding parameterizes every application query against a PostgreSQL pool. SQL migrations are authoritative; no parallel ORM-generated schema is maintained.

Registration transaction: team + three members + versioned declarations + ticket hash + audit record. A cryptographically random client submission key is hashed as the idempotency lookup. Same key and normalized payload return the original registration; a changed payload conflicts. Concurrent insert collisions roll back and either recover the original committed registration or return a duplicate conflict.

The browser retains the submission key and frozen payload across uncertain outcomes. Session storage is temporary draft/recovery convenience, never authoritative. Successful retrieval requires an HTTP-only cookie derived from the secret recovery key. A recovery endpoint accepts the key and restores access. There is no email service and no claim that confirmation emails are sent.

Admission starts pending review. Reviewers inspect enrollment using external university evidence, approve or flag; administrators may revoke. Authorized check-in locks team and ticket rows; revocation locks the same team, preventing an admission/revocation race. A unique check-in constraint enforces one admission action.

Local PostgreSQL uses the development-only embedded-postgres package. Production must use a managed PostgreSQL service. No SQLite or mock backend fallback exists.
