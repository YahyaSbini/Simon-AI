import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { timeSection, timeSectionItem } from "@/db/schema";

export async function nextSectionPosition(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(timeSection.position) })
    .from(timeSection)
    .where(eq(timeSection.userId, userId));
  return (row?.value ?? -1) + 1;
}

export async function nextItemPosition(sectionId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(timeSectionItem.position) })
    .from(timeSectionItem)
    .where(eq(timeSectionItem.sectionId, sectionId));
  return (row?.value ?? -1) + 1;
}

export async function ownsSection(
  userId: string,
  sectionId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: timeSection.id })
    .from(timeSection)
    .where(and(eq(timeSection.id, sectionId), eq(timeSection.userId, userId)));
  return Boolean(row);
}

/** Renumber the user's sections 0..n-1 in the given order; ids must be all of them. */
export async function reorderSections(
  userId: string,
  ids: string[],
): Promise<boolean> {
  const rows = await db
    .select({ id: timeSection.id })
    .from(timeSection)
    .where(eq(timeSection.userId, userId));
  if (!sameIds(rows, ids)) return false;

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(timeSection)
        .set({ position: index, updatedAt: new Date() })
        .where(and(eq(timeSection.id, id), eq(timeSection.userId, userId)));
    }
  });
  return true;
}

/** Renumber a section's items 0..n-1 in the given order; ids must be all of them. */
export async function reorderItems(
  userId: string,
  sectionId: string,
  ids: string[],
): Promise<boolean> {
  const rows = await db
    .select({ id: timeSectionItem.id })
    .from(timeSectionItem)
    .where(
      and(
        eq(timeSectionItem.sectionId, sectionId),
        eq(timeSectionItem.userId, userId),
      ),
    );
  if (!sameIds(rows, ids)) return false;

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(timeSectionItem)
        .set({ position: index, updatedAt: new Date() })
        .where(
          and(
            eq(timeSectionItem.id, id),
            eq(timeSectionItem.sectionId, sectionId),
          ),
        );
    }
  });
  return true;
}

function sameIds(rows: { id: string }[], ids: string[]): boolean {
  const unique = new Set(ids);
  return (
    unique.size === ids.length &&
    rows.length === ids.length &&
    rows.every((row) => unique.has(row.id))
  );
}
