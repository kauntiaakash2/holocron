import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, type SQL } from "drizzle-orm";
const globalDb = globalThis as unknown as { pool?: Pool };
export const pool =
  globalDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
if (process.env.NODE_ENV !== "production") globalDb.pool = pool;
export const db = drizzle(pool);
export { sql };
export async function rows<T = Record<string, unknown>>(
  query: SQL,
): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}
