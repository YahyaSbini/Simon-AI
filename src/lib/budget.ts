import { dueDateIn, monthBounds } from "@/lib/money";
import type { BudgetItemRow, EntryItem } from "@/lib/types";

export type BudgetLine = {
  item: BudgetItemRow;
  spentCents: number;
  /** Bills only: the date this month's payment falls on, and whether it has posted. */
  dueDate: string | null;
  paid: boolean;
};

export type MonthTotals = {
  incomeCents: number;
  spentCents: number;
  budgetedCents: number;
};

/** Budget items that existed during `month`. */
export function activeIn(items: BudgetItemRow[], month: string) {
  const { end } = monthBounds(month);
  return items.filter((item) => item.startDate <= end);
}

export function budgetLines(
  items: BudgetItemRow[],
  entries: EntryItem[],
  month: string,
): BudgetLine[] {
  return activeIn(items, month).map((item) => {
    if (item.dueDay) {
      const posted = entries.filter((entry) => entry.budgetItemId === item.id);
      const due = dueDateIn(month, item.dueDay);
      return {
        item,
        spentCents: posted.reduce((sum, entry) => sum + entry.amountCents, 0),
        dueDate: due >= item.startDate ? due : null,
        paid: posted.length > 0,
      };
    }

    const spentCents = entries
      .filter(
        (entry) =>
          entry.kind === "expense" &&
          !entry.budgetItemId &&
          item.categoryId !== null &&
          entry.categoryId === item.categoryId,
      )
      .reduce((sum, entry) => sum + entry.amountCents, 0);

    return { item, spentCents, dueDate: null, paid: false };
  });
}

export function monthTotals(
  items: BudgetItemRow[],
  entries: EntryItem[],
  month: string,
): MonthTotals {
  let incomeCents = 0;
  let spentCents = 0;
  for (const entry of entries) {
    if (entry.kind === "income") incomeCents += entry.amountCents;
    else spentCents += entry.amountCents;
  }
  const budgetedCents = activeIn(items, month).reduce(
    (sum, item) => sum + item.amountCents,
    0,
  );
  return { incomeCents, spentCents, budgetedCents };
}
