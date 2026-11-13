import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => (jar.has(key) ? { value: jar.get(key) } : undefined),
    set: (key: string, value: string) => jar.set(key, value),
  }),
}));
vi.mock("../lib/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { sql } = await import("drizzle-orm");
  const engine = new PGlite();
  const db = drizzle(engine);
  return {
    db,
    sql,
    engine,
    rows: async (query: Parameters<typeof db.execute>[0]) =>
      (await db.execute(query)).rows,
  };
});
import { GET, POST } from "../app/api/[...path]/route";
import { db, sql } from "../lib/db";
import { passwordHash, credential } from "../lib/security";
const origin = "https://test.example";
const makeInput = () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  return {
    teamName: `Crew ${suffix}`,
    members: [0, 1, 2].map((i) => ({
      fullName: "Test Builder",
      rollNumber: suffix + i,
      email: `${suffix}${i}@kiit.ac.in`,
      phone: "9876543210",
      academicYear: i + 1,
      branch: "CSE",
    })),
    consents: {
      undergraduate: true,
      years: true,
      teamSize: true,
      accuracy: true,
      terms: true,
      privacy: true,
    },
    website: "",
  };
};
async function call(
  path: string,
  data?: unknown,
  headers: Record<string, string> = {},
) {
  const request = new Request(`${origin}/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return (data === undefined ? GET : POST)(request, {
    params: Promise.resolve({ path: path.split("?")[0].split("/") }),
  });
}
const key = () => randomUUID() + randomUUID();
beforeAll(async () => {
  process.env.APP_ORIGIN = origin;
  process.env.TOKEN_SECRET =
    "synthetic-test-secret-at-least-thirty-two-characters";
  process.env.REGISTRATION_OPEN = "true";
  process.env.POLICY_APPROVED = "true";
  process.env.KIIT_EMAIL_DOMAINS = "kiit.ac.in";
  const { engine } = (await import("../lib/db")) as unknown as {
    engine: { exec: (s: string) => Promise<unknown> };
  };
  await engine.exec(await readFile("migrations/001_initial.sql", "utf8"));
  for (const role of ["admin", "reviewer", "checkin"])
    await db.execute(
      sql`INSERT INTO admin_users(id,email,password_hash,role) VALUES(${randomUUID()},${`${role}@example.test`},${passwordHash("long test password only")},${role})`,
    );
}, 30000);
beforeEach(async () => {
  jar.clear();
  await db.execute(sql`DELETE FROM rate_limits`);
});
afterAll(async () => {
  const { engine } = (await import("../lib/db")) as unknown as {
    engine: { close: () => Promise<void> };
  };
  await engine.close();
});
async function login(role = "admin") {
  const response = await call("admin/login", {
    email: `${role}@example.test`,
    password: "long test password only",
  });
  expect(response.status).toBe(200);
}
async function register() {
  const input = makeInput(),
    k = key();
  const response = await call("registrations", input, { "Idempotency-Key": k });
  expect(response.status).toBe(201);
  return { input, key: k, ...(await response.json()) };
}
it("commits registration, retrieves persisted roster, and replays original identity", async () => {
  const r = await register();
  const replay = await call("registrations", r.input, {
    "Idempotency-Key": r.key,
  });
  expect((await replay.json()).id).toBe(r.id);
  const data = await (await call(`registrations/${r.id}`)).json();
  expect(data.members).toHaveLength(3);
  expect(data.status).toBe("pending_review");
  expect(data.members[0].is_team_leader).toBe(true);
});
it("denies unauthorized details and recovers only with secret possession", async () => {
  const r = await register();
  jar.clear();
  expect((await call(`registrations/${r.id}`)).status).toBe(404);
  expect((await call(`registrations/${r.id}/ticket`)).status).toBe(404);
  expect((await call("registrations/recover", { key: key() })).status).toBe(
    404,
  );
  expect((await call("registrations/recover", { key: r.key })).status).toBe(
    200,
  );
  expect((await call(`registrations/${r.id}`)).status).toBe(200);
});
it("rejects active participant collision and changed idempotent payload", async () => {
  const r = await register();
  expect(
    (
      await call(
        "registrations",
        { ...r.input, teamName: "Different Name" },
        { "Idempotency-Key": key() },
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await call(
        "registrations",
        { ...r.input, teamName: "Changed Name" },
        { "Idempotency-Key": r.key },
      )
    ).status,
  ).toBe(409);
});
it("enforces origin, eligibility, email domains, and closed registration", async () => {
  expect(
    (
      await call("registrations", makeInput(), {
        Origin: "https://evil.test",
        "Idempotency-Key": key(),
      })
    ).status,
  ).toBe(403);
  const input = makeInput();
  input.members[0].email = "outsider@example.org";
  expect(
    (await call("registrations", input, { "Idempotency-Key": key() })).status,
  ).toBe(422);
  process.env.REGISTRATION_OPEN = "false";
  try {
    expect(
      (await call("registrations", makeInput(), { "Idempotency-Key": key() }))
        .status,
    ).toBe(503);
  } finally {
    process.env.REGISTRATION_OPEN = "true";
  }
});
it("enforces organizer roles for private review, export, revoke, and check-in", async () => {
  expect((await call("admin/registrations")).status).toBe(401);
  await login("checkin");
  expect((await call("admin/registrations")).status).toBe(403);
  jar.clear();
  const r = await register();
  await login("reviewer");
  expect(
    (await call(`admin/registrations/${r.id}`, { action: "revoke" })).status,
  ).toBe(403);
  expect((await call("admin/registrations?format=csv")).status).toBe(403);
  expect(
    (await call("admin/tickets/check-in", { token: "a".repeat(43) })).status,
  ).toBe(403);
});
it("implements pending, valid, already-checked-in, revoked, invalid ticket states", async () => {
  const r = await register();
  const data = await (await call(`registrations/${r.id}`)).json();
  const token = credential("ticket", data.ticket_id);
  const verify = async () =>
    await (await call(`tickets/verify/${token}`)).json();
  expect((await verify()).status).toBe("pending_review");
  await login();
  expect((await call("admin/tickets/check-in", { token })).status).toBe(409);
  expect(
    (await call(`admin/registrations/${r.id}`, { action: "approve" })).status,
  ).toBe(200);
  expect(await verify()).toEqual({
    status: "valid",
    registrationId: r.id,
    teamName: r.input.teamName,
  });
  expect((await call("admin/tickets/check-in", { token })).status).toBe(200);
  expect((await call("admin/tickets/check-in", { token })).status).toBe(409);
  expect((await verify()).status).toBe("already_checked_in");
  expect(
    (await call(`admin/registrations/${r.id}`, { action: "revoke" })).status,
  ).toBe(200);
  expect((await verify()).status).toBe("revoked");
  expect((await call("admin/tickets/check-in", { token })).status).toBe(409);
  expect(
    (await call(`admin/registrations/${r.id}`, { action: "approve" })).status,
  ).toBe(409);
  expect((await (await call("tickets/verify/invalid")).json()).status).toBe(
    "invalid",
  );
});
it("allows a new registration after organizer revocation releases identities", async () => {
  const r = await register();
  await login();
  expect(
    (await call(`admin/registrations/${r.id}`, { action: "revoke" })).status,
  ).toBe(200);
  const replacement = await call("registrations", r.input, {
    "Idempotency-Key": key(),
  });
  expect(replacement.status).toBe(201);
  expect((await replacement.json()).id).not.toBe(r.id);
});
it("throttles repeated login attempts and invalidates logout sessions", async () => {
  await login();
  expect((await call("admin/me")).status).toBe(200);
  await call("admin/logout", {});
  expect((await call("admin/me")).status).toBe(401);
  for (let i = 0; i < 7; i++)
    await call("admin/login", { email: "absent@example.test", password: "no" });
  expect(
    (
      await call("admin/login", {
        email: "absent@example.test",
        password: "no",
      })
    ).status,
  ).toBe(429);
});
