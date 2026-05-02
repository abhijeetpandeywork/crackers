import { pgTable, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category", { enum: ["Ground","Aerial","Sparkler","Novelty","Gift Box","Bundle"] }).notNull(),
  description: text("description"),
  hsnCode: text("hsn_code"),
  onlineDisplay: boolean("online_display").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  imageUrl: text("image_url"),
  status: text("status", { enum: ["Active","Discontinued"] }).notNull().default("Active"),
  // variants stored as JSON: [{variantId, size, packContent, unit, prices:{purchase,wholesaleBulk,retailOnline,retailEst,agent}}]
  variants: jsonb("variants").$type<ProductVariant[]>().notNull().default([]),
  reorderLevel: integer("reorder_level").default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProductVariant = {
  variantId: string;
  size: string;
  packContent?: string;
  unit?: string;
  prices: {
    purchase: number;
    wholesaleBulk: number;
    retailOnline: number;
    retailEst: number;
    agent: number;
  };
};

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
