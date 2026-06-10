import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminIfNeeded() {
  try {
    const allUsers = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable);
    const hasAnyWithPassword = allUsers.some(u => u.username !== null);

    if (!hasAnyWithPassword) {
      const passwordHash = await bcrypt.hash("admin1", 12);
      if (allUsers.length === 0) {
        await db.insert(usersTable).values({
          username: "admin",
          passwordHash,
          firstName: "Admin",
          role: "manager",
        });
        logger.info("Inserted admin account (username: admin, password: admin1)");
      } else {
        await db.update(usersTable).set({ username: "admin", passwordHash, role: "manager" });
        logger.info("Seeded admin credentials onto existing user (username: admin, password: admin1)");
      }
    }
  } catch (err) {
    logger.error({ err }, "Seed failed — continuing anyway");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedAdminIfNeeded();
});
