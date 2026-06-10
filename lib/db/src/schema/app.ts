import { pgTable, serial, varchar, jsonb, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

export const insertChecksheetSchema = createInsertSchema(checksheetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectChecksheetSchema = createSelectSchema(checksheetsTable);
export type InsertChecksheet = z.infer<typeof insertChecksheetSchema>;
export type Checksheet = typeof checksheetsTable.$inferSelect;

export const insertMeasurementSchema = createInsertSchema(measurementsTable).omit({ id: true, timestamp: true });
export const selectMeasurementSchema = createSelectSchema(measurementsTable);
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurementsTable.$inferSelect;
