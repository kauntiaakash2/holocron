import { Pool } from "pg";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
const [email, role = "admin"] = process.argv.slice(2);
const password = process.env.ADMIN_INITIAL_PASSWORD;
if (
  !email?.includes("@") ||
  !password ||
  password.length < 16 ||
  !["admin", "reviewer", "checkin"].includes(role)
)
  throw new Error(
    "Usage: ADMIN_INITIAL_PASSWORD=<16+ chars> npm run admin:create -- email role",
  );
const salt = randomBytes(16).toString("hex");
const digest = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(
    "INSERT INTO admin_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)",
    [randomUUID(), email.toLowerCase(), digest, role],
  );
  console.log("Organizer created.");
} finally {
  await pool.end();
}
