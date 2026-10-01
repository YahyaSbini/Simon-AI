import { and, asc, desc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import type {
  BudgetItem,
  FinanceCategory,
  FinanceEntry,
  SavingsGoal,
} from "@/db/schema";
import {
  budgetItem,
  financeCategory,
  financeEntry,
  financeSettings,
  savingsGoal,
} from "@/db/schema";
import { addMonths, dueDateIn, monthBounds, monthOf } from "@/lib/money";
import type {
  BudgetItemRow,
  CategoryItem,
  EntryItem,
  SavingsGoalItem,
} from "@/lib/types";

const defaultCategories: { kind: "income" | "expense"; name: string }[] = [
  { kind: "income", name: "Salary" },
  { kind: "income", name: "Other income" },
  { kind: "expense", name: "Housing" },
  { kind: "expense", name: "Groceries" },
  { kind: "expense", name: "Transport" },
  { kind: "expense", name: "Bills" },
  { kind: "expense", name: "Eating out" },
  { kind: "expense", name: "Health" },
  { kind: "expense", name: "Other" },
];

export function serializeCategory(row: FinanceCategory): CategoryItem {
  return { id: row.id, kind: row.kind, name: row.name };
}

export function serializeEntry(row: FinanceEntry): EntryItem {
  return {
    id: row.id,
    kind: row.kind,
    amountCents: row.amountCents,
    categoryId: row.categoryId,
    budgetItemId: row.budgetItemId,
    date: row.date,
    note: row.note,
  };
}

export function serializeBudgetItem(row: BudgetItem): BudgetItemRow {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    dueDay: row.dueDay,
    startDate: row.startDate,
  };
}

export function serializeSavingsGoal(row: SavingsGoal): SavingsGoalItem {
  return {
    id: row.id,
    name: row.name,
    targetCents: row.targetCents,
    savedCents: row.savedCents,
    targetDate: row.targetDate,
  };
}

/** Creates the user's settings row on first use and seeds starter categories with it. */
export async function getCurrency(userId: string): Promise<string> {
  const [created] = await db
    .insert(financeSettings)
    .values({ userId })
    .onConflictDoNothing()
    .returning();

  if (created) {
    await db.insert(financeCategory).values(
      defaultCategories.map((category, position) => ({
        ...category,
        userId,
        position,
      })),
    );
    return created.currency;
  }

  const [row] = await db
    .select({ currency: financeSettings.currency })
    .from(financeSettings)
    .where(eq(financeSettings.userId, userId));

  return row?.currency ?? "USD";
}

/** Due dates of a bill after `after` (exclusive) up to `through` (inclusive). */
export function dueDatesBetween(
  item: Pick<BudgetItem, "dueDay" | "startDate">,
  after: string | null,
  through: string,
): string[] {
  if (!item.dueDay) return [];
  const from = after && after > item.startDate ? after : item.startDate;
  const dates: string[] = [];
  const last = monthOf(through);

  for (let month = monthOf(from); month <= last; month = addMonths(month, 1)) {
    const due = dueDateIn(month, item.dueDay);
    if (due >= item.startDate && due <= through && (!after || due > after)) {
      dates.push(due);
    }
  }

  return dates;
}

/** Posts every bill that has come due since it last ran, at most once per month. */
export async function postDueBills(userId: string, today: string) {
  const bills = await db
    .select()
    .from(budgetItem)
    .where(and(eq(budgetItem.userId, userId), isNotNull(budgetItem.dueDay)));

  for (const bill of bills) {
    if (bill.postedThrough && bill.postedThrough >= today) continue;
    const dates = dueDatesBetween(bill, bill.postedThrough, today);

    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(budgetItem)
        .set({ postedThrough: today })
        .where(
          and(
            eq(budgetItem.id, bill.id),
            bill.postedThrough
              ? eq(budgetItem.postedThrough, bill.postedThrough)
              : isNull(budgetItem.postedThrough),
          ),
        )
        .returning({ id: budgetItem.id });

      if (!claimed || !dates.length) return;

      const existing = await tx
        .select({ date: financeEntry.date })
        .from(financeEntry)
        .where(
          and(
            eq(financeEntry.budgetItemId, bill.id),
            gte(financeEntry.date, monthBounds(monthOf(dates[0])).start),
          ),
        );
      const postedMonths = new Set(existing.map((row) => monthOf(row.date)));
      const pending = dates.filter((date) => !postedMonths.has(monthOf(date)));

      if (pending.length) {
        await tx.insert(financeEntry).values(
          pending.map((date) => ({
            userId,
            kind: "expense" as const,
            amountCents: bill.amountCents,
            categoryId: bill.categoryId,
            budgetItemId: bill.id,
            date,
            note: bill.name,
          })),
        );
      }
    });
  }
}

export async function getCategories(userId: string): Promise<CategoryItem[]> {
  const rows = await db
    .select()
    .from(financeCategory)
    .where(eq(financeCategory.userId, userId))
    .orderBy(asc(financeCategory.position), asc(financeCategory.createdAt));
  return rows.map(serializeCategory);
}

export async function getMonthEntries(
  userId: string,
  month: string,
): Promise<EntryItem[]> {
  const { start, end } = monthBounds(month);
  const rows = await db
    .select()
    .from(financeEntry)
    .where(
      and(
        eq(financeEntry.userId, userId),
        gte(financeEntry.date, start),
        lte(financeEntry.date, end),
      ),
    )
    .orderBy(desc(financeEntry.date), desc(financeEntry.createdAt));
  return rows.map(serializeEntry);
}

export async function getBudgetItems(userId: string): Promise<BudgetItemRow[]> {
  const rows = await db
    .select()
    .from(budgetItem)
    .where(eq(budgetItem.userId, userId))
    .orderBy(asc(budgetItem.createdAt));
  return rows.map(serializeBudgetItem);
}

export async function getSavingsGoals(
  userId: string,
): Promise<SavingsGoalItem[]> {
  const rows = await db
    .select()
    .from(savingsGoal)
    .where(eq(savingsGoal.userId, userId))
    .orderBy(asc(savingsGoal.createdAt));
  return rows.map(serializeSavingsGoal);
}

/** Everything a month view needs, after posting bills that came due. */
export async function getFinanceMonth(
  userId: string,
  month: string,
  today: string,
) {
  const currency = await getCurrency(userId);
  await postDueBills(userId, today);
  const [categories, entries, budget] = await Promise.all([
    getCategories(userId),
    getMonthEntries(userId, month),
    getBudgetItems(userId),
  ]);
  return { currency, categories, entries, budget };
}

export async function ownsCategory(
  userId: string,
  categoryId: string | null | undefined,
): Promise<boolean> {
  if (!categoryId) return true;
  const [row] = await db
    .select({ id: financeCategory.id })
    .from(financeCategory)
    .where(
      and(
        eq(financeCategory.id, categoryId),
        eq(financeCategory.userId, userId),
      ),
    );
  return Boolean(row);
}
