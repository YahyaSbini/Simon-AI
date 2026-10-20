import { and, count, eq, isNull, max } from "drizzle-orm";
import { db } from "@/db";
import { activity, dayBlock } from "@/db/schema";
import { asBlockColor } from "@/lib/block-colors";
import { sameIds } from "@/lib/time-sections";
import type { ActivityItem } from "@/lib/types";

export function serializeActivity(
  row: typeof activity.$inferSelect,
): ActivityItem {
  return { id: row.id, name: row.name, emoji: row.emoji, color: row.color };
}

export async function findActivity(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(activity)
    .where(and(eq(activity.id, id), eq(activity.userId, userId)));
  return row ?? null;
}

/** Block fields that mirror the activity. */
export function blockFieldsOf(row: typeof activity.$inferSelect) {
  return {
    activityId: row.id,
    label: row.name,
    emoji: row.emoji,
    color: row.color,
  };
}

export async function nextActivityPosition(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(activity.position) })
    .from(activity)
    .where(eq(activity.userId, userId));
  return (row?.value ?? -1) + 1;
}

/** How many day blocks use each of the user's activities. */
export async function activityUsage(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ id: dayBlock.activityId, uses: count() })
    .from(dayBlock)
    .where(eq(dayBlock.userId, userId))
    .groupBy(dayBlock.activityId);
  return Object.fromEntries(
    rows.filter((row) => row.id).map((row) => [row.id, row.uses]),
  );
}

export async function unlinkedBlockCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(dayBlock)
    .where(and(eq(dayBlock.userId, userId), isNull(dayBlock.activityId)));
  return row?.value ?? 0;
}

/** Renumber the user's activities 0..n-1 in the given order; ids must be all of them. */
export async function reorderActivities(
  userId: string,
  ids: string[],
): Promise<boolean> {
  const rows = await db
    .select({ id: activity.id })
    .from(activity)
    .where(eq(activity.userId, userId));
  if (!sameIds(rows, ids)) return false;

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(activity)
        .set({ position: index, updatedAt: new Date() })
        .where(and(eq(activity.id, id), eq(activity.userId, userId)));
    }
  });
  return true;
}

function keyOf(name: string, emoji: string | null): string {
  return `${name.trim().toLowerCase()}\u0000${emoji?.trim() ?? ""}`;
}

/**
 * Link every block without an activity to one with the same name and emoji,
 * creating the missing activities. Returns how many blocks were linked.
 */
export async function importActivities(userId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const blocks = await tx
      .select()
      .from(dayBlock)
      .where(and(eq(dayBlock.userId, userId), isNull(dayBlock.activityId)));
    if (!blocks.length) return 0;

    const existing = await tx
      .select()
      .from(activity)
      .where(eq(activity.userId, userId));
    const byKey = new Map(
      existing.map((row) => [keyOf(row.name, row.emoji), row]),
    );
    let position =
      existing.reduce((value, row) => Math.max(value, row.position), -1) + 1;

    for (const block of blocks) {
      const label = block.label.trim();
      const emoji = block.emoji?.trim() || null;
      // An emoji-only block becomes an activity named by that emoji.
      const name = label || emoji || "Activity";
      const ownEmoji = label ? emoji : null;
      const key = keyOf(name, ownEmoji);
      let target = byKey.get(key);
      if (!target) {
        [target] = await tx
          .insert(activity)
          .values({
            userId,
            name,
            emoji: ownEmoji,
            color: asBlockColor(block.color),
            position: position++,
          })
          .returning();
        byKey.set(key, target);
      }
      await tx
        .update(dayBlock)
        .set({ ...blockFieldsOf(target), updatedAt: new Date() })
        .where(eq(dayBlock.id, block.id));
    }
    return blocks.length;
  });
}
