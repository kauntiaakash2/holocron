import { access } from "node:fs/promises";
import EmbeddedPostgres from "embedded-postgres";
const pg = new EmbeddedPostgres({
  databaseDir: ".local-db",
  user: "holocron",
  password: "localonly",
  port: 54330,
  persistent: true,
});
try {
  await access(".local-db/PG_VERSION");
} catch {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("holocron");
} catch {
  /* already created */
}
console.log("Local PostgreSQL ready on 54330. Development only.");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
