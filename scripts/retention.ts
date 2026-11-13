/** Dry-run by default. Use a policy-approved cutoff, after the event retention window. */
import { Pool } from "pg";
const cutoff = process.env.RETENTION_CUTOFF;
if (
  !cutoff ||
  !/^\d{4}-\d{2}-\d{2}$/.test(cutoff) ||
  !Number.isFinite(Date.parse(cutoff))
)
  throw new Error(
    "Set RETENTION_CUTOFF=YYYY-MM-DD to the organizer-approved creation cutoff.",
  );
if (Date.now() < Date.parse("2027-01-30T00:00:00+05:30"))
  throw new Error(
    "The proposed post-event retention period has not elapsed. Use a separately reviewed rights-request procedure for earlier deletion.",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const result = await client.query(
    "SELECT count(*)::int AS count FROM teams WHERE created_at < $1",
    [cutoff],
  );
  console.log(
    `${result.rows[0].count} registrations eligible for deletion; audit records retained without team references.`,
  );
  if (process.argv.includes("--execute")) {
    if (process.env.POLICY_APPROVED !== "true")
      throw new Error("Organizer policy approval required.");
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM check_ins WHERE ticket_id IN (SELECT k.id FROM tickets k JOIN teams t ON t.id=k.team_id WHERE t.created_at < $1)",
      [cutoff],
    );
    await client.query("DELETE FROM teams WHERE created_at < $1", [cutoff]);
    await client.query("COMMIT");
    console.log(
      "Retention deletion completed. Apply approved backup expiry separately.",
    );
  } else
    console.log("Dry-run only; pass --execute to apply the reviewed deletion.");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
