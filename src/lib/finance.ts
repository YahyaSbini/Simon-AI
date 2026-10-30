import { and, asc, desc, eq, gt, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import type {
  BudgetItem,
  BudgetItemMonth,
  FinanceCategory,
  FinanceEntry,
  SavingsGoal,
} from "@/db/schema";
import {
  budgetItem,
  budgetItemMonth,
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
    expected: row.expected,
  };
}

export function serializeBudgetItem(row: BudgetItem): BudgetItemRow {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    dueDay: row.dueDay,
    notes: row.notes,
    startDate: row.startDate,
    repeats: row.repeats,
    endMonth: row.endMonth,
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

type BudgetValues = Pick<
  BudgetItem,
  "name" | "amountCents" | "categoryId" | "dueDay" | "notes"
>;

export function monthKey(itemId: string, month: string) {
  return `${itemId}:${month}`;
}

/** Whether a budget item belongs to `month`, before any per-month change. */
export function appliesIn(
  item: Pick<BudgetItem, "startDate" | "repeats" | "endMonth">,
  month: string,
): boolean {
  const first = monthOf(item.startDate);
  if (!item.repeats) return month === first;
  return month >= first && (!item.endMonth || month <= item.endMonth);
}

export function valuesOf(row: BudgetValues): BudgetValues {
  return {
    name: row.name,
    amountCents: row.amountCents,
    categoryId: row.categoryId,
    dueDay: row.dueDay,
    notes: row.notes,
  };
}

/** The item's values in `month`: its month copy when there is one, null when taken out. */
export function valuesIn(
  item: BudgetItem,
  override: BudgetItemMonth | undefined,
): BudgetValues | null {
  if (!override) return valuesOf(item);
  return override.removed ? null : valuesOf(override);
}

/** Bills of an item that fall due after `after` (exclusive) up to `through` (inclusive). */
export function dueBillsBetween(
  item: BudgetItem,
  overrides: Map<string, BudgetItemMonth>,
  after: string | null,
  through: string,
): (BudgetValues & { date: string })[] {
  const from = after && after > item.startDate ? after : item.startDate;
  const bills: (BudgetValues & { date: string })[] = [];
  const last = monthOf(through);

  for (let month = monthOf(from); month <= last; month = addMonths(month, 1)) {
    if (!appliesIn(item, month)) continue;
    const values = valuesIn(item, overrides.get(monthKey(item.id, month)));
    if (!values?.dueDay) continue;
    const due = dueDateIn(month, values.dueDay);
    if (due >= item.startDate && due <= through && (!after || due > after)) {
      bills.push({ ...values, date: due });
    }
  }

  return bills;
}

async function getOverrides(userId: string, through: string) {
  const rows = await db
    .select()
    .from(budgetItemMonth)
    .where(
      and(
        eq(budgetItemMonth.userId, userId),
        lte(budgetItemMonth.month, through),
      ),
    );
  return new Map(
    rows.map((row) => [monthKey(row.budgetItemId, row.month), row]),
  );
}

/** Posts every bill that has come due since it last ran, at most once per month. */
export async function postDueBills(userId: string, today: string) {
  const [items, overrides] = await Promise.all([
    db.select().from(budgetItem).where(eq(budgetItem.userId, userId)),
    getOverrides(userId, monthOf(today)),
  ]);

  for (const item of items) {
    if (item.postedThrough && item.postedThrough >= today) continue;
    const bills = dueBillsBetween(item, overrides, item.postedThrough, today);

    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(budgetItem)
        .set({ postedThrough: today })
        .where(
          and(
            eq(budgetItem.id, item.id),
            item.postedThrough
              ? eq(budgetItem.postedThrough, item.postedThrough)
              : isNull(budgetItem.postedThrough),
          ),
        )
        .returning({ id: budgetItem.id });

      if (!claimed || !bills.length) return;

      const existing = await tx
        .select({ date: financeEntry.date })
        .from(financeEntry)
        .where(
          and(
            eq(financeEntry.budgetItemId, item.id),
            gte(financeEntry.date, monthBounds(monthOf(bills[0].date)).start),
          ),
        );
      const postedMonths = new Set(existing.map((row) => monthOf(row.date)));
      const pending = bills.filter(
        (bill) => !postedMonths.has(monthOf(bill.date)),
      );

      if (pending.length) {
        await tx.insert(financeEntry).values(
          pending.map((bill) => ({
            userId,
            kind: "expense" as const,
            amountCents: bill.amountCents,
            categoryId: bill.categoryId,
            budgetItemId: item.id,
            date: bill.date,
            note: bill.name,
          })),
        );
      }
    });
  }
}

/**
 * Posts `month`'s bill for an item right away when its day has already passed and
 * nothing is posted for that month yet. Used after a month's due day is changed.
 */
export async function postMonthIfDue(
  userId: string,
  itemId: string,
  month: string,
  today: string,
) {
  // Locks the item row so this and `postDueBills` never post the same month twice.
  await db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(budgetItem)
      .where(and(eq(budgetItem.id, itemId), eq(budgetItem.userId, userId)))
      .for("update");
    if (!item || !appliesIn(item, month)) return;
    const [override] = await tx
      .select()
      .from(budgetItemMonth)
      .where(
        and(
          eq(budgetItemMonth.budgetItemId, itemId),
          eq(budgetItemMonth.month, month),
        ),
      );
    const values = valuesIn(item, override);
    if (!values?.dueDay) return;
    const due = dueDateIn(month, values.dueDay);
    if (due < item.startDate || due > today) return;
    const { start, end } = monthBounds(month);
    const [posted] = await tx
      .select({ id: financeEntry.id })
      .from(financeEntry)
      .where(
        and(
          eq(financeEntry.budgetItemId, itemId),
          gte(financeEntry.date, start),
          lte(financeEntry.date, end),
        ),
      );
    if (posted) return;
    await tx.insert(financeEntry).values({
      userId,
      kind: "expense",
      amountCents: values.amountCents,
      categoryId: values.categoryId,
      budgetItemId: itemId,
      date: due,
      note: values.name,
    });
  });
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

/** Budget items of `month`, with that month's own changes applied. */
export async function getBudgetMonth(
  userId: string,
  month: string,
): Promise<BudgetItemRow[]> {
  const [items, overrides] = await Promise.all([
    db
      .select()
      .from(budgetItem)
      .where(eq(budgetItem.userId, userId))
      .orderBy(asc(budgetItem.createdAt)),
    db
      .select()
      .from(budgetItemMonth)
      .where(
        and(
          eq(budgetItemMonth.userId, userId),
          eq(budgetItemMonth.month, month),
        ),
      ),
  ]);
  const byItem = new Map(overrides.map((row) => [row.budgetItemId, row]));
  return items.flatMap((item) => {
    if (!appliesIn(item, month)) return [];
    const values = valuesIn(item, byItem.get(item.id));
    // Repeats only if it carries on after this month.
    const repeats = item.repeats && (!item.endMonth || item.endMonth > month);
    return values ? [serializeBudgetItem({ ...item, ...values, repeats })] : [];
  });
}

/** Repeating items that still run after `current`: the default list. */
export async function getDefaultItems(
  userId: string,
  current: string,
): Promise<BudgetItemRow[]> {
  const rows = await db
    .select()
    .from(budgetItem)
    .where(
      and(
        eq(budgetItem.userId, userId),
        eq(budgetItem.repeats, true),
        or(isNull(budgetItem.endMonth), gt(budgetItem.endMonth, current)),
      ),
    )
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
  await ensureFinanceSetup(userId);
  await postDueBills(userId, today);
  const [categories, entries, budget, defaults] = await Promise.all([
    getCategories(userId),
    getMonthEntries(userId, month),
    getBudgetMonth(userId, month),
    getDefaultItems(userId, monthOf(today)),
  ]);
  return { categories, entries, budget, defaults };
}

/** What the budget page shows for `month` after a change: items, defaults and entries. */
export async function getBudgetSnapshot(
  userId: string,
  month: string,
  today: string,
) {
  await postDueBills(userId, today);
  const [entries, budget, defaults] = await Promise.all([
    getMonthEntries(userId, month),
    getBudgetMonth(userId, month),
    getDefaultItems(userId, monthOf(today)),
  ]);
  return { entries, budget, defaults };
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
