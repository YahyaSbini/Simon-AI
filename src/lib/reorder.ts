import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { routine, task } from "@/db/schema";

/**
 * Persist a new order for a subset of a user's rows. The subset takes over the
 * slots it already occupied in the full ordering (so hidden rows keep their
 * place relative to it), then every row is renumbered 0..n-1 so positions stay
 * unique even when the table started with duplicates.
 */
export async function reorderRows(
  table: typeof task | typeof routine,
  userId: string,
  ids: string[],
): Promise<boolean> {
  const all = await db
    .select({ id: table.id, position: table.position })
    .from(table)
    .where(eq(table.userId, userId))
    .orderBy(asc(table.position), asc(table.createdAt));

  const selected = new Set(ids);
  if (selected.size !== ids.length) return false;
  if (all.filter((row) => selected.has(row.id)).length !== ids.length) {
    return false;
  }

  let next = 0;
  const order = all.map((row) => (selected.has(row.id) ? ids[next++] : row.id));
  const current = new Map(all.map((row) => [row.id, row.position]));

  await db.transaction(async (tx) => {
    for (const [index, id] of order.entries()) {
      if (current.get(id) === index) continue;
      await tx
        .update(table)
        .set({ position: index, updatedAt: new Date() })
        .where(and(eq(table.id, id), eq(table.userId, userId)));
    }
  });

  return true;
}
