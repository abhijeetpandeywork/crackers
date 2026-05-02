import { db, stockLedgerTable, stockLevelsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export type LedgerEntryType = "IN" | "OUT" | "MOVE" | "ADJUST" | "DAMAGE" | "RESERVE" | "UNRESERVE";

interface LedgerEntry {
  productId: string;
  variantId: string;
  locationId: string;
  type: LedgerEntryType;
  qty: number;
  batchNo?: string;
  refType?: string;
  refId?: string;
  notes?: string;
  createdBy?: string;
}

export async function appendLedger(entry: LedgerEntry) {
  await db.insert(stockLedgerTable).values(entry);

  // Update materialized stock levels
  const existing = await db
    .select()
    .from(stockLevelsTable)
    .where(
      and(
        eq(stockLevelsTable.productId, entry.productId),
        eq(stockLevelsTable.variantId, entry.variantId),
        eq(stockLevelsTable.locationId, entry.locationId)
      )
    )
    .limit(1);

  const currentQty = existing[0]?.currentQty ?? 0;
  const newQty = currentQty + entry.qty;

  if (existing.length === 0) {
    await db.insert(stockLevelsTable).values({
      productId: entry.productId,
      variantId: entry.variantId,
      locationId: entry.locationId,
      currentQty: newQty,
      reservedQty: 0,
    });
  } else {
    await db
      .update(stockLevelsTable)
      .set({ currentQty: newQty, updatedAt: new Date() })
      .where(
        and(
          eq(stockLevelsTable.productId, entry.productId),
          eq(stockLevelsTable.variantId, entry.variantId),
          eq(stockLevelsTable.locationId, entry.locationId)
        )
      );
  }
}

export async function getStockLevel(productId: string, variantId: string, locationId: string): Promise<number> {
  const row = await db
    .select()
    .from(stockLevelsTable)
    .where(
      and(
        eq(stockLevelsTable.productId, productId),
        eq(stockLevelsTable.variantId, variantId),
        eq(stockLevelsTable.locationId, locationId)
      )
    )
    .limit(1);
  return row[0]?.currentQty ?? 0;
}
