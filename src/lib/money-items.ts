import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import type { MoneyItem } from "@/db/schema";
import { financeEntry, moneyItem } from "@/db/schema";
import { addMonths, dueDateIn, monthBounds, monthOf } from "@/lib/money";
import type { MoneyItemRow } from "@/lib/types";
import type { moneyItemUpdate } from "@/lib/validation";
import type { z } from "zod";

/** Months a repeating item is copied into, counting the current one. */
const monthsAhead = 12;

type ItemUpdate = z.infer<typeof moneyItemUpdate>;

export function serializeMoneyItem(row: MoneyItem): MoneyItemRow {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    day: row.day,
    repeats: row.repeats,
    startMonth: row.startMonth,
  };
}

export async function getMoneyItems(userId: string): Promise<MoneyItemRow[]> {
  const rows = await db
    .select()
    .from(moneyItem)
    .where(eq(moneyItem.userId, userId))
    .orderBy(asc(moneyItem.createdAt));
  return rows.map(serializeMoneyItem);
}

function later(a: string, b: string): string {
  return a > b ? a : b;
}

/** Months the item should appear in but hasn't been copied into yet. */
function pendingMonths(item: MoneyItem, today: string): string[] {
  const last = item.repeats
    ? later(item.startMonth, addMonths(monthOf(today), monthsAhead - 1))
    : item.startMonth;
  const first = item.filledThrough
    ? addMonths(item.filledThrough, 1)
    : item.startMonth;
  const months: string[] = [];
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

function entryFor(item: MoneyItem, month: string) {
  return {
    userId: item.userId,
    kind: item.kind,
    amountCents: item.amountCents,
    categoryId: item.categoryId,
    moneyItemId: item.id,
    date: dueDateIn(month, item.day),
    note: item.name,
  };
}

/** Copies an item into its new months. Each month is filled only once, so deleted copies stay deleted. */
export async function fillItem(item: MoneyItem, today: string) {
  const months = pendingMonths(item, today);
  if (!months.length) return;

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(moneyItem)
      .set({ filledThrough: months.at(-1) })
      .where(
        and(
          eq(moneyItem.id, item.id),
          item.filledThrough
            ? eq(moneyItem.filledThrough, item.filledThrough)
            : isNull(moneyItem.filledThrough),
        ),
      )
      .returning({ id: moneyItem.id });

    if (claimed) {
      await tx
        .insert(financeEntry)
        .values(months.map((month) => entryFor(item, month)));
    }
  });
}

export async function fillItemMonths(userId: string, today: string) {
  const items = await db
    .select()
    .from(moneyItem)
    .where(eq(moneyItem.userId, userId));
  for (const item of items) await fillItem(item, today);
}

/**
 * Saves an edit and passes it on to the item's month copies:
 * name, type, category and day change every month; a new amount only
 * changes months after the current one that weren't edited by hand.
 */
export async function updateMoneyItem(
  item: MoneyItem,
  patch: ItemUpdate,
  today: string,
): Promise<MoneyItem> {
  const thisMonth = monthOf(today);
  const keepMonth = later(thisMonth, item.startMonth);
  const stopsRepeating = item.repeats && patch.repeats === false;
  const linked = eq(financeEntry.moneyItemId, item.id);

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(moneyItem)
      .set({
        ...patch,
        ...(stopsRepeating ? { filledThrough: keepMonth } : {}),
        updatedAt: new Date(),
      })
      .where(eq(moneyItem.id, item.id))
      .returning();

    if (
      row.name !== item.name ||
      row.kind !== item.kind ||
      row.categoryId !== item.categoryId
    ) {
      await tx
        .update(financeEntry)
        .set({
          note: row.name,
          kind: row.kind,
          categoryId: row.categoryId,
          updatedAt: new Date(),
        })
        .where(linked);
    }

    if (row.day !== item.day) {
      const copies = await tx
        .select({ id: financeEntry.id, date: financeEntry.date })
        .from(financeEntry)
        .where(linked);
      for (const copy of copies) {
        await tx
          .update(financeEntry)
          .set({ date: dueDateIn(monthOf(copy.date), row.day) })
          .where(eq(financeEntry.id, copy.id));
      }
    }

    if (row.amountCents !== item.amountCents) {
      await tx
        .update(financeEntry)
        .set({ amountCents: row.amountCents, updatedAt: new Date() })
        .where(
          and(
            linked,
            gt(financeEntry.date, monthBounds(thisMonth).end),
            eq(financeEntry.amountCents, item.amountCents),
          ),
        );
    }

    if (stopsRepeating) {
      await tx
        .delete(financeEntry)
        .where(and(linked, gt(financeEntry.date, monthBounds(keepMonth).end)));
    }

    return row;
  });

  await fillItem(updated, today);
  return updated;
}

/** Deletes an item and its copies after the current month; earlier months stay as normal entries. */
export async function deleteMoneyItem(item: MoneyItem, today: string) {
  await db.transaction(async (tx) => {
    await tx
      .delete(financeEntry)
      .where(
        and(
          eq(financeEntry.moneyItemId, item.id),
          gt(financeEntry.date, monthBounds(monthOf(today)).end),
        ),
      );
    await tx.delete(moneyItem).where(eq(moneyItem.id, item.id));
  });
}
