import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Immutable append-only stock ledger
export const stockLedgerTable = pgTable("stock_ledger", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull(),
  variantId: text("variant_id").notNull(),
  locationId: text("location_id").notNull(),
  type: text("type", { enum: ["IN","OUT","MOVE","ADJUST","DAMAGE","RESERVE","UNRESERVE"] }).notNull(),
  qty: integer("qty").notNull(), // positive = in, negative = out
  batchNo: text("batch_no"),
  refType: text("ref_type"), // INVOICE, PO, TRANSFER, MANUAL, etc.
  refId: text("ref_id"),
  notes: text("notes"),
  createdBy: text("created_by"),
  ts: timestamp("ts").defaultNow().notNull(),
});

// Materialized current stock levels (computed from ledger)
export const stockLevelsTable = pgTable("stock_levels", {
  productId: text("product_id").notNull(),
  variantId: text("variant_id").notNull(),
  locationId: text("location_id").notNull(),
  currentQty: integer("current_qty").notNull().default(0),
  reservedQty: integer("reserved_qty").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStockLedgerSchema = createInsertSchema(stockLedgerTable).omit({ id: true, ts: true });
export type InsertStockLedger = z.infer<typeof insertStockLedgerSchema>;
export type StockLedger = typeof stockLedgerTable.$inferSelect;
