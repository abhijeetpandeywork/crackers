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

// Drizzle's tx and db expose the same query builder API, so a single signature
// works for both. Defaulting to `db` keeps existing call-sites compatible.
// We type as `any` here because the transaction type is not assignable to the
// concrete NodePgDatabase type (missing `$client`), but the query API is the same.
type DbLike = any;

export async function appendLedger(entry: LedgerEntry, tx: DbLike = db) {
  await tx.insert(stockLedgerTable).values(entry);

  // Atomic upsert: `current_qty = current_qty + delta` is computed by Postgres
  // itself, so two concurrent transactions cannot lose-update each other.
  // Relies on the composite primary key (product, variant, location).
  await tx
    .insert(stockLevelsTable)
    .values({
      productId: entry.productId,
      variantId: entry.variantId,
      locationId: entry.locationId,
      currentQty: entry.qty,
      reservedQty: 0,
    })
    .onConflictDoUpdate({
      target: [
        stockLevelsTable.productId,
        stockLevelsTable.variantId,
        stockLevelsTable.locationId,
      ],
      set: {
        currentQty: sql`${stockLevelsTable.currentQty} + ${entry.qty}`,
        updatedAt: new Date(),
      },
    });
}

export async function getStockLevel(productId: string, variantId: string, locationId: string): Promise<number> {
  const row = await db
    .select()
    .from(stockLevelsTable)
    .where(
      and(
        eq(stockLevelsTable.productId, productId),
        eq(stockLevelsTable.variantId, variantId),
        eq(stockLevelsTable.locationId, locationId),
      ),
    )
    .limit(1);
  return row[0]?.currentQty ?? 0;
}
