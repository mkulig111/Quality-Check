import { pgTable, serial, varchar, jsonb, timestamp, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const checksheetsTable = pgTable("checksheets", {
  id: serial("id").primaryKey(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  machine: varchar("machine", { length: 100 }).notNull(),
  measurementFields: jsonb("measurement_fields").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const measurementsTable = pgTable("measurements", {
  id: serial("id").primaryKey(),
  checksheetId: serial("checksheet_id").references(() => checksheetsTable.id),
  checksheetName: varchar("checksheet_name", { length: 255 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  machine: varchar("machine", { length: 100 }).notNull(),
  inspector: varchar("inspector", { length: 255 }).notNull(),
  measurements: jsonb("measurements").notNull().default({}),
  issues: jsonb("issues").notNull().default([]),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const auditsTable = pgTable("audits", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  checksheetId: integer("checksheet_id").references(() => checksheetsTable.id),
  checksheetName: varchar("checksheet_name", { length: 255 }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  machine: varchar("machine", { length: 100 }).notNull(),
  assigneeId: varchar("assignee_id").references(() => usersTable.id),
  assigneeName: varchar("assignee_name", { length: 255 }),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  recurrence: varchar("recurrence", { enum: ["none", "daily", "weekly", "monthly"] }).notNull().default("none"),
  status: varchar("status", { enum: ["pending", "overdue", "completed"] }).notNull().default("pending"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: varchar("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertChecksheetSchema = createInsertSchema(checksheetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectChecksheetSchema = createSelectSchema(checksheetsTable);
export type InsertChecksheet = z.infer<typeof insertChecksheetSchema>;
export type Checksheet = typeof checksheetsTable.$inferSelect;

export const insertMeasurementSchema = createInsertSchema(measurementsTable).omit({ id: true, timestamp: true });
export const selectMeasurementSchema = createSelectSchema(measurementsTable);
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurementsTable.$inferSelect;

export const insertAuditSchema = createInsertSchema(auditsTable).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const selectAuditSchema = createSelectSchema(auditsTable);
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
