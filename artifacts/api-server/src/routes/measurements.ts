import { Router } from "express";
import { db, measurementsTable, checksheetsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/measurements", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { department, checksheetName, startDate, endDate, limit: limitParam } = req.query;
    const limit = parseInt((limitParam as string) || "100", 10);

    const conditions = [];
    if (department && typeof department === "string") {
      conditions.push(eq(measurementsTable.department, department));
    }
    if (checksheetName && typeof checksheetName === "string") {
      conditions.push(eq(measurementsTable.checksheetName, checksheetName));
    }
    if (startDate && typeof startDate === "string") {
      conditions.push(gte(measurementsTable.timestamp, new Date(startDate)));
    }
    if (endDate && typeof endDate === "string") {
      conditions.push(lte(measurementsTable.timestamp, new Date(endDate)));
    }

    const rows = await db
      .select()
      .from(measurementsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(measurementsTable.timestamp))
      .limit(limit);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch measurements" });
  }
});

router.post("/measurements", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { checksheetId, checksheetName, department, machine, measurements, issues } = req.body;
    const inspector = req.user.email || req.user.firstName || req.user.id;

    const [row] = await db
      .insert(measurementsTable)
      .values({ checksheetId, checksheetName, department, machine, inspector, measurements, issues: issues || [] })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create measurement" });
  }
});

router.put("/measurements/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    const { measurements, issues } = req.body;
    const [row] = await db
      .update(measurementsTable)
      .set({ measurements, issues })
      .where(eq(measurementsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update measurement" });
  }
});

router.delete("/measurements/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(measurementsTable).where(eq(measurementsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete measurement" });
  }
});

export default router;
