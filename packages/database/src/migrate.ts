import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * Apply infrastructure/sql/*.sql in sorted order when DATABASE_URL is set.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skip migrate (in-memory project graph still works)");
    process.exit(0);
  }
  const dir = join(process.cwd(), "../../infrastructure/sql");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    console.log(`Applying ${f}…`);
    await client.query(sql);
  }
  await client.end();
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
