import { Router } from "express";
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
      .select({ id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
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
    const [row] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user role" });
  }
});

export default router;
