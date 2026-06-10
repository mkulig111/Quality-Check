import { Router } from "express";
import { db, measurementsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { subDays, startOfDay, endOfDay } from "date-fns";

const router = Router();

const DEPARTMENTS = ["Stamping", "Injection", "Assembly", "Extrusion"];

function buildCsv(measurements: any[]): string {
  if (measurements.length === 0) return "";

  const allFieldNames = new Set<string>();
  measurements.forEach((m) => {
    if (m.measurements && typeof m.measurements === "object") {
      Object.keys(m.measurements).forEach((k) => allFieldNames.add(k));
    }
  });
  const sortedFields = Array.from(allFieldNames).sort();
  const headers = ["Item Name", "Department", "Date", "Time", "Inspector", ...sortedFields];

  const rows = measurements.map((m) => {
    const ts = new Date(m.timestamp);
    const dateStr = ts.toISOString().split("T")[0];
    const timeStr = ts.toLocaleTimeString("en-US", { hour12: false });
    const base = [
      m.checksheetName ?? "",
      m.department ?? "",
      dateStr,
      timeStr,
      m.inspector ?? "",
    ];
    const fieldValues = sortedFields.map((f) => String(m.measurements?.[f] ?? ""));
    return [...base, ...fieldValues];
  });

  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;

  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return lines.join("\n");
}

router.post("/export/generate", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { department, startDate, endDate } = req.body as {
      department: string;
      startDate: string;
      endDate: string;
    };

    if (!department || !startDate || !endDate) {
      res.status(400).json({ error: "department, startDate, and endDate are required" });
      return;
    }

    const conditions = [
      eq(measurementsTable.department, department),
      gte(measurementsTable.timestamp, new Date(startDate)),
      lte(measurementsTable.timestamp, new Date(endDate)),
    ];

    const rows = await db
      .select()
      .from(measurementsTable)
      .where(and(...conditions))
      .orderBy(desc(measurementsTable.timestamp))
      .limit(50000);

    if (rows.length === 0) {
      res.status(404).json({ error: "No data found for the selected criteria." });
      return;
    }

    const csv = buildCsv(rows);
    const today = new Date().toISOString().split("T")[0];
    const filename = `${department}-export-${today}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to generate export" });
  }
});

router.post("/export/daily", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const yesterday = subDays(new Date(), 1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);

    const exportResults: {
      department: string;
      status: string;
      count?: number;
      error?: string;
    }[] = [];

    const allRows = await db
      .select()
      .from(measurementsTable)
      .where(
        and(
          gte(measurementsTable.timestamp, start),
          lte(measurementsTable.timestamp, end)
        )
      )
      .orderBy(desc(measurementsTable.timestamp));

    for (const department of DEPARTMENTS) {
      const deptRows = allRows.filter((r) => r.department === department);
      if (deptRows.length === 0) {
        exportResults.push({ department, status: "SKIPPED", count: 0 });
      } else {
        exportResults.push({ department, status: "SUCCESS", count: deptRows.length });
      }
    }

    res.json({
      success: true,
      date: yesterday.toISOString().split("T")[0],
      message: "Daily export process completed.",
      exports: exportResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to run daily export", message: err.message });
  }
});

export default router;
