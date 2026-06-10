import { Router } from "express";
import { db, auditsTable, measurementsTable, checksheetsTable } from "@workspace/db";
import { eq, or, isNull, desc } from "drizzle-orm";
import { addDays, addWeeks, addMonths } from "date-fns";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function requireManager(req: any, res: any): boolean {
  if (!requireAuth(req, res)) return false;
  if (req.user.role !== "manager") {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.get("/audits", async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let rows;
    if (role === "manager") {
      rows = await db.select().from(auditsTable).orderBy(desc(auditsTable.scheduledDate));
    } else {
      rows = await db
        .select()
        .from(auditsTable)
        .where(or(eq(auditsTable.assigneeId, userId), isNull(auditsTable.assigneeId)))
        .orderBy(desc(auditsTable.scheduledDate));
    }
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch audits" });
  }
});

router.post("/audits", async (req, res) => {
  if (!requireManager(req, res)) return;
  try {
    const { title, checksheetId, checksheetName, department, machine, assigneeId, assigneeName, scheduledDate, recurrence } = req.body;
    const [row] = await db
      .insert(auditsTable)
      .values({
        title,
        checksheetId: checksheetId ? Number(checksheetId) : null,
        checksheetName,
        department,
        machine,
        assigneeId: assigneeId || null,
        assigneeName: assigneeName || null,
        scheduledDate: new Date(scheduledDate),
        recurrence: recurrence || "none",
        status: "pending",
        createdBy: req.user.id,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create audit" });
  }
});

router.put("/audits/:id", async (req, res) => {
  if (!requireManager(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    const { title, assigneeId, assigneeName, scheduledDate, recurrence } = req.body;
    const [row] = await db
      .update(auditsTable)
      .set({
        title,
        assigneeId: assigneeId || null,
        assigneeName: assigneeName || null,
        scheduledDate: new Date(scheduledDate),
        recurrence: recurrence || "none",
      })
      .where(eq(auditsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update audit" });
  }
});

router.delete("/audits/:id", async (req, res) => {
  if (!requireManager(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(auditsTable).where(eq(auditsTable.id, id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete audit" });
  }
});

router.post("/audits/:id/complete", async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    const { measurements, issues } = req.body;

    const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, id));
    if (!audit) { res.status(404).json({ error: "Audit not found" }); return; }

    const inspector = req.user.email || req.user.firstName || req.user.id;

    await db
      .insert(measurementsTable)
      .values({
        checksheetId: audit.checksheetId!,
        checksheetName: audit.checksheetName,
        department: audit.department,
        machine: audit.machine,
        inspector,
        measurements: measurements || {},
        issues: issues || [],
      });

    await db
      .update(auditsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(auditsTable.id, id));

    if (audit.recurrence !== "none") {
      const base = new Date(audit.scheduledDate);
      let nextDate: Date;
      if (audit.recurrence === "daily") nextDate = addDays(base, 1);
      else if (audit.recurrence === "weekly") nextDate = addWeeks(base, 1);
      else nextDate = addMonths(base, 1);

      await db.insert(auditsTable).values({
        title: audit.title,
        checksheetId: audit.checksheetId,
        checksheetName: audit.checksheetName,
        department: audit.department,
        machine: audit.machine,
        assigneeId: audit.assigneeId,
        assigneeName: audit.assigneeName,
        scheduledDate: nextDate,
        recurrence: audit.recurrence,
        status: "pending",
        createdBy: audit.createdBy,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to complete audit" });
  }
});

export default router;
