import { pgTable, text, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const returnsTable = pgTable("returns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type", { enum: ["customer","supplier","online"] }).notNull(),
  referenceId: text("reference_id"),
  items: jsonb("items").$type<Array<{productId:string;variantId:string;qty:number}>>().notNull().default([]),
  reason: text("reason").notNull(),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 2 }).default("0"),
  status: text("status", { enum: ["pending","approved","rejected"] }).notNull().default("approved"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const damageLedgerTable = pgTable("damage_ledger", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: text("location_id").notNull(),
  productId: text("product_id").notNull(),
  variantId: text("variant_id").notNull(),
  batchNo: text("batch_no"),
  qty: decimal("qty", { precision: 10, scale: 0 }).notNull(),
  category: text("category", { enum: ["transit","storage","handling","expired","other"] }).notNull(),
  description: text("description"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReturnSchema = createInsertSchema(returnsTable).omit({ id: true, createdAt: true });
export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returnsTable.$inferSelect;
