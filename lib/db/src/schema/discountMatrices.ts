import { pgTable, text, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const discountMatricesTable = pgTable("discount_matrices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  channel: text("channel", { enum: ["POS", "WHOLESALE", "AGENT", "ALL"] }).default("ALL").notNull(),
  category: text("category"),
  brandId: text("brand_id"),
  discountPct: decimal("discount_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDiscountMatrixSchema = createInsertSchema(discountMatricesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDiscountMatrix = z.infer<typeof insertDiscountMatrixSchema>;
export type DiscountMatrix = typeof discountMatricesTable.$inferSelect;
