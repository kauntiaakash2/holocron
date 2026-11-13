import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile("migrations/001_initial.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await db.close();
});
async function createTeam(name: string, rollPrefix: string, count = 3) {
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO teams(id,public_registration_id,normalized_team_name,team_name,access_hash,idempotency_hash,request_hash) VALUES($1,$2,$3,$3,$4,$5,$6)",
      [id, randomUUID(), name, "hash", randomUUID(), "request"],
    );
    for (let i = 0; i < count; i++)
      await tx.query(
        "INSERT INTO participants(id,team_id,position,full_name,roll_number,email,phone,academic_year,branch,is_team_leader) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          randomUUID(),
          id,
          i,
          "Builder",
          rollPrefix + i,
          rollPrefix + i + "@kiit.ac.in",
          "9876543210",
          1,
          "CSE",
          i === 0,
        ],
      );
  });
  return id;
}
describe("actual migration on PostgreSQL WASM engine (not network concurrency)", () => {
  it("commits exactly three members", async () => {
    const id = await createTeam("valid", "V");
    const r = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM participants WHERE team_id=$1",
      [id],
    );
    expect(r.rows[0].count).toBe(3);
  });
  it("rolls back incomplete rosters at commit", async () => {
    await expect(createTeam("incomplete", "I", 2)).rejects.toThrow(
      "exactly three",
    );
    const r = await db.query(
      "SELECT id FROM teams WHERE normalized_team_name=$1",
      ["incomplete"],
    );
    expect(r.rows).toHaveLength(0);
  });
  it("enforces active name, roll and email uniqueness", async () => {
    await expect(createTeam("valid", "N")).rejects.toThrow();
    await expect(createTeam("another", "V")).rejects.toThrow();
  });
  it("prevents deleting one participant from a committed roster", async () => {
    await expect(
      db.query("DELETE FROM participants WHERE roll_number='V0'"),
    ).rejects.toThrow("exactly three");
  });
  it("releases active identity constraints after transactional revocation", async () => {
    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE teams SET status='revoked' WHERE normalized_team_name='valid'",
      );
      await tx.query(
        "UPDATE participants SET active=false WHERE roll_number IN ('V0','V1','V2')",
      );
    });
    await expect(createTeam("valid", "V")).resolves.toBeTypeOf("string");
  });
  it("rejects year four in database even without schema validation", async () => {
    await expect(
      db.query("UPDATE participants SET academic_year=4 WHERE active"),
    ).rejects.toThrow();
  });
  it("prevents duplicate ticket check-ins at database level", async () => {
    const team = await createTeam("checkin", "C"),
      ticket = randomUUID(),
      admin = randomUUID();
    await db.query(
      "INSERT INTO tickets(id,team_id,verification_token_hash) VALUES($1,$2,$3)",
      [ticket, team, randomUUID()],
    );
    await db.query(
      "INSERT INTO admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)",
      [admin, "test@example.org", "fixture", "checkin"],
    );
    await db.query(
      "INSERT INTO check_ins(id,ticket_id,checked_in_by) VALUES($1,$2,$3)",
      [randomUUID(), ticket, admin],
    );
    await expect(
      db.query(
        "INSERT INTO check_ins(id,ticket_id,checked_in_by) VALUES($1,$2,$3)",
        [randomUUID(), ticket, admin],
      ),
    ).rejects.toThrow();
  });
});

it("prevents moving a full roster away and leaving an existing team empty", async () => {
  const source = await createTeam("source", "M");
  const target = randomUUID();
  await expect(
    db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO teams(id,public_registration_id,normalized_team_name,team_name,access_hash,idempotency_hash,request_hash) VALUES($1,$2,$3,$3,$4,$5,$6)",
        [target, randomUUID(), "target", "hash", randomUUID(), "request"],
      );
      await tx.query("UPDATE participants SET team_id=$1 WHERE team_id=$2", [
        target,
        source,
      ]);
    }),
  ).rejects.toThrow("exactly three");
});
