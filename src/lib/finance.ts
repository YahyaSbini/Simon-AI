import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
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
import { monthBounds } from "@/lib/money";
import { fillItemMonths } from "@/lib/money-items";
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
    moneyItemId: row.moneyItemId,
    date: row.date,
    note: row.note,
    expected: row.expected,
  };
}

export function serializeBudgetItem(row: BudgetItem): BudgetItemRow {
  return {
    id: row.id,
    month: row.month,
    kind: row.kind,
    name: row.name,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    moneyItemId: row.moneyItemId,
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
export async function ensureFinanceSetup(userId: string): Promise<void> {
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

export async function getBudgetItems(
  userId: string,
  month: string,
): Promise<BudgetItemRow[]> {
  const rows = await db
    .select()
    .from(budgetItem)
    .where(and(eq(budgetItem.userId, userId), eq(budgetItem.month, month)))
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

export type MonthSummary = {
  month: string;
  incomeCents: number;
  outcomeCents: number;
};

/** Settled income and outcome per month of `year`; expected entries are left out. */
export async function getYearSummary(
  userId: string,
  year: number,
  today: string,
): Promise<MonthSummary[]> {
  await ensureFinanceSetup(userId);
  await fillItemMonths(userId, today);
  const rows = await db
    .select()
    .from(financeEntry)
    .where(
      and(
        eq(financeEntry.userId, userId),
        eq(financeEntry.expected, false),
        gte(financeEntry.date, `${year}-01-01`),
        lte(financeEntry.date, `${year}-12-31`),
      ),
    );
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    incomeCents: 0,
    outcomeCents: 0,
  }));
  for (const row of rows) {
    const summary = months[Number(row.date.slice(5, 7)) - 1];
    if (row.kind === "income") summary.incomeCents += row.amountCents;
    else summary.outcomeCents += row.amountCents;
  }
  return months;
}

/** Planned income and outcome per month of `year`, from the month budgets. */
export async function getBudgetYearSummary(
  userId: string,
  year: number,
): Promise<MonthSummary[]> {
  const rows = await db
    .select()
    .from(budgetItem)
    .where(
      and(
        eq(budgetItem.userId, userId),
        gte(budgetItem.month, `${year}-01`),
        lte(budgetItem.month, `${year}-12`),
      ),
    );
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    incomeCents: 0,
    outcomeCents: 0,
  }));
  for (const row of rows) {
    const summary = months[Number(row.month.slice(5, 7)) - 1];
    if (row.kind === "income") summary.incomeCents += row.amountCents;
    else summary.outcomeCents += row.amountCents;
  }
  return months;
}

/** Everything a month view needs, after filling In/Out item copies. */
export async function getFinanceMonth(
  userId: string,
  month: string,
  today: string,
) {
  await ensureFinanceSetup(userId);
  await fillItemMonths(userId, today);
  const [categories, entries] = await Promise.all([
    getCategories(userId),
    getMonthEntries(userId, month),
  ]);
  return { categories, entries };
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
