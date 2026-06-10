import { Router } from "express";
import { db, checksheetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/checksheets", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { department } = req.query;
    let rows;
    if (department && typeof department === "string") {
      rows = await db.select().from(checksheetsTable).where(eq(checksheetsTable.department, department));
    } else {
      rows = await db.select().from(checksheetsTable);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch checksheets" });
  }
});

router.post("/checksheets", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const { itemName, department, machine, measurementFields } = req.body;
    const [row] = await db.insert(checksheetsTable).values({ itemName, department, machine, measurementFields }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create checksheet" });
  }
});

router.put("/checksheets/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    const { itemName, department, machine, measurementFields } = req.body;
    const [row] = await db.update(checksheetsTable).set({ itemName, department, machine, measurementFields }).where(eq(checksheetsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update checksheet" });
  }
});

router.delete("/checksheets/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(checksheetsTable).where(eq(checksheetsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete checksheet" });
  }
});

export default router;
