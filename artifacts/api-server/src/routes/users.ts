import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/users", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/users", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { username, password, firstName, lastName, role = "inspector" } =
    req.body as {
      username?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  if (!["manager", "inspector"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [row] = await db
      .insert(usersTable)
      .values({
        username: username.toLowerCase().trim(),
        passwordHash,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        role: role as "manager" | "inspector",
      })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });
    res.status(201).json(row);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Username already taken" });
    } else {
      res.status(500).json({ error: "Failed to create user" });
    }
  }
});

router.patch("/users/:id/role", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!["manager", "inspector"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const [row] = await db
      .update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update user role" });
  }
});

router.delete("/users/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      res.status(400).json({ error: "Cannot delete your own account" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
