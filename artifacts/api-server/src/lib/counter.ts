import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function getAndIncrement(key: string, prefix: string, pad = 5): Promise<string> {
  const row = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  let next = 1;
  if (row.length && typeof row[0]!.value === "number") {
    next = (row[0]!.value as number) + 1;
  }
  await db
    .insert(settingsTable)
    .values({ key, value: next })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: next } });
  return `${prefix}${String(next).padStart(pad, "0")}`;
}

export const nextEstimateNo = () => getAndIncrement("counter_estimate", "EST", 5);
export const nextInvoiceNo = () => getAndIncrement("counter_invoice", "INV", 5);
export const nextPoNumber = () => getAndIncrement("counter_po", "PO", 5);
export const nextTransferNo = () => getAndIncrement("counter_transfer", "TRF", 5);
export const nextPackingJobNo = () => getAndIncrement("counter_packing", "PKG", 5);
