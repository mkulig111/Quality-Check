/**
 * stamp.ts — Mark all existing migration files as already applied.
 *
 * Use this ONCE on a database that was previously set up via `drizzle-kit push`
 * (which doesn't create migration tracking records). After stamping, use
 * `pnpm --filter @workspace/db run migrate` for all future schema changes.
 *
 * Usage:
 *   pnpm --filter @workspace/db run stamp
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const migrationsFolder = path.join(__dirname, "../migrations");
const journalPath = path.join(migrationsFolder, "meta/_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
  entries: Array<{ tag: string }>;
};

await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
await client.query(`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`);

const { rows: applied } = await client.query<{ hash: string }>(
  `SELECT hash FROM drizzle.__drizzle_migrations`,
);
const appliedHashes = new Set(applied.map((r) => r.hash));

let stamped = 0;
for (const entry of journal.entries) {
  const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
  const sql = fs.readFileSync(sqlPath, "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");

  if (appliedHashes.has(hash)) {
    console.log(`  already stamped: ${entry.tag}`);
    continue;
  }

  await client.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
    [hash, Date.now()],
  );
  console.log(`  stamped: ${entry.tag}`);
  stamped++;
}

console.log(
  stamped > 0
    ? `\nDone — ${stamped} migration(s) stamped. Run "migrate" for future schema changes.`
    : `\nAll migrations were already stamped — nothing to do.`,
);

await client.end();
