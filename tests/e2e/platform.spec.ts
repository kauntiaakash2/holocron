import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
const base = process.env.TEST_ORIGIN || "http://localhost:3000";
const payload = () => {
  const suffix = Date.now().toString().slice(-9);
  return {
    teamName: `Crew ${suffix}`,
    members: [0, 1, 2].map((i) => ({
      fullName: ["Asha Rao", "Mira Das", "Arun Sen"][i],
      rollNumber: `2${suffix}${i}`,
      email: `b${suffix}${i}@kiit.ac.in`,
      phone: "9876543210",
      academicYear: i + 1,
      branch: "Computer Science",
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
const headers = (key: string) => ({ Origin: base, "Idempotency-Key": key });
let pool: Pool;
test.beforeAll(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});
test.afterAll(async () => {
  await pool.end();
});
test.beforeEach(async () => {
  await pool.query("DELETE FROM rate_limits");
});
test("transactional registration, retries, privacy, QR, exports and organizer lifecycle", async ({
  request,
  browser,
}) => {
  const data = payload(),
    key = randomUUID() + randomUUID();
  const responses = await Promise.all([
    request.post("/api/registrations", { data, headers: headers(key) }),
    request.post("/api/registrations", { data, headers: headers(key) }),
  ]);
  for (const r of responses) expect(r.status()).toBe(201);
  const first = await responses[0].json(),
    second = await responses[1].json();
  expect(first.id).toBe(second.id);
  const stored = await request.get(`/api/registrations/${first.id}`);
  expect(stored.status()).toBe(200);
  const team = await stored.json();
  expect(team.members).toHaveLength(3);
  expect(team.status).toBe("pending_review");
  const outsider = await browser.newContext();
  expect(
    (await outsider.request.get(`/api/registrations/${first.id}`)).status(),
  ).toBe(404);
  expect(
    (await outsider.request.get("/api/admin/registrations")).status(),
  ).toBe(401);
  const duplicate = await request.post("/api/registrations", {
    data: { ...data, teamName: data.teamName + " other" },
    headers: headers(randomUUID() + randomUUID()),
  });
  expect(duplicate.status()).toBe(409);
  const conflict = await request.post("/api/registrations", {
    data: { ...data, teamName: "Changed Crew" },
    headers: headers(key),
  });
  expect(conflict.status()).toBe(409);
  const svg = await (
    await request.get(`/api/registrations/${first.id}/ticket`)
  ).text();
  expect(svg).toContain(first.id);
  expect(svg).not.toContain(data.members[0].email);
  const png = await request.get(
    `/api/registrations/${first.id}/ticket?format=png`,
  );
  expect(png.status()).toBe(200);
  expect((await png.body()).subarray(1, 4).toString()).toBe("PNG");
  const pdf = await request.get(
    `/api/registrations/${first.id}/ticket?format=pdf`,
  );
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const { createHmac } = await import("node:crypto");
  const token = createHmac("sha256", process.env.TOKEN_SECRET!)
    .update(`ticket:${team.ticket_id}`)
    .digest("base64url");
  const verified = await (
    await request.get(`/api/tickets/verify/${token}`)
  ).json();
  expect(verified.status).toBe("pending_review");
  expect(Object.keys(verified).sort()).toEqual([
    "registrationId",
    "status",
    "teamName",
  ]);
  expect(
    (
      await request.post("/api/admin/tickets/check-in", {
        data: { token },
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(401);
  const login = await request.post("/api/admin/login", {
    data: {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.ADMIN_INITIAL_PASSWORD,
    },
    headers: { Origin: base },
  });
  expect(login.status()).toBe(200);
  expect(
    (
      await request.post("/api/admin/tickets/check-in", {
        data: { token },
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(`/api/admin/registrations/${first.id}`, {
        data: { action: "approve" },
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await request.get(`/api/tickets/verify/${token}`)).json()).status,
  ).toBe("valid");
  const scans = await Promise.all([
    request.post("/api/admin/tickets/check-in", {
      data: { token },
      headers: { Origin: base },
    }),
    request.post("/api/admin/tickets/check-in", {
      data: { token },
      headers: { Origin: base },
    }),
  ]);
  expect(scans.map((r) => r.status()).sort()).toEqual([200, 409]);
  expect(
    (await (await request.get(`/api/tickets/verify/${token}`)).json()).status,
  ).toBe("already_checked_in");
  expect(
    (
      await request.post(`/api/admin/registrations/${first.id}`, {
        data: { action: "revoke" },
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await request.get(`/api/tickets/verify/${token}`)).json()).status,
  ).toBe("revoked");
  expect(
    (
      await request.post("/api/admin/tickets/check-in", {
        data: { token },
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await outsider.request.post("/api/registrations/recover", {
        data: { key },
        headers: { Origin: base },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await outsider.request.get(`/api/registrations/${first.id}`)).status(),
  ).toBe(200);
  await outsider.close();
});
test("different teams racing for the same members cannot both commit", async ({
  request,
}) => {
  const data = payload();
  const responses = await Promise.all(
    ["A", "B"].map((s) =>
      request.post("/api/registrations", {
        data: { ...data, teamName: data.teamName + s },
        headers: headers(randomUUID() + randomUUID()),
      }),
    ),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
});
test("rejects CSRF, malformed, ineligible and bot requests", async ({
  request,
}) => {
  const data = payload();
  expect(
    (
      await request.post("/api/registrations", {
        data,
        headers: {
          Origin: "https://evil.test",
          "Idempotency-Key": randomUUID() + randomUUID(),
        },
      })
    ).status(),
  ).toBe(403);
  for (const invalid of [
    { ...data, members: data.members.slice(1) },
    { ...data, website: "spam" },
    { ...data, members: data.members.map((m) => ({ ...m, academicYear: 4 })) },
  ])
    expect(
      (
        await request.post("/api/registrations", {
          data: invalid,
          headers: headers(randomUUID() + randomUUID()),
        })
      ).status(),
    ).toBe(422);
});
test("mobile wizard registers, survives refresh and exports ticket", async ({
  page,
}) => {
  const data = payload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  await page.getByLabel("Team name", { exact: true }).fill(data.teamName);
  await page.getByLabel("Team leader full name").fill(data.members[0].fullName);
  await page.getByLabel("Team leader KIIT email").fill(data.members[0].email);
  await page.getByRole("button", { name: "CONTINUE" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("tab").nth(i).click();
    const m = data.members[i];
    await page.getByLabel("Full name", { exact: true }).fill(m.fullName);
    await page.getByLabel("KIIT email address").fill(m.email);
    await page.getByLabel("KIIT roll number").fill(m.rollNumber);
    await page.getByLabel("Phone number").fill(m.phone);
    await page.getByLabel("Year of study").selectOption(String(m.academicYear));
    await page.getByLabel("School or branch").fill(m.branch);
  }
  await page.getByRole("button", { name: "CONTINUE" }).click();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "CONTINUE" }).click();
  await page
    .getByRole("button", { name: "CONFIRM MISSION REGISTRATION" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Archive access granted." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: data.teamName, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ticket-preview")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "DOWNLOAD PNG" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});
