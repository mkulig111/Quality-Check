import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const db = drizzle(client);

console.log("Running migrations...");
await migrate(db, {
  migrationsFolder: path.join(__dirname, "../migrations"),
});
console.log("Migrations applied successfully.");

await client.end();
