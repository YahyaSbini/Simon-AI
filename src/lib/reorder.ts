import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { routine, task } from "@/db/schema";

/**
 * Persist a new order for a subset of rows. The rows keep the set of
 * `position` values they already had, redistributed in the given order, so
 * items outside the subset stay where they are relative to it.
 */
export async function reorderRows(
  table: typeof task | typeof routine,
  userId: string,
  ids: string[],
): Promise<boolean> {
  const rows = await db
    .select({ id: table.id, position: table.position })
    .from(table)
    .where(and(eq(table.userId, userId), inArray(table.id, ids)));

  if (rows.length !== ids.length) return false;

  const slots = rows.map((row) => row.position).sort((a, b) => a - b);
  const unique = new Set(slots).size === slots.length;
  const positions = unique ? slots : ids.map((_, index) => index);

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(table)
        .set({ position: positions[index], updatedAt: new Date() })
        .where(and(eq(table.id, id), eq(table.userId, userId)));
    }
  });

  return true;
}
