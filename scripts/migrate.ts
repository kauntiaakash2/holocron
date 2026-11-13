import { readFile } from "node:fs/promises";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(70311026)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  const exists = await client.query(
    "SELECT version FROM schema_migrations WHERE version=$1",
    ["001"],
  );
  if (!exists.rowCount) {
    await client.query(await readFile("migrations/001_initial.sql", "utf8"));
    await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [
      "001",
    ]);
  }
  await client.query("COMMIT");
  console.log("Database migrations applied.");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
