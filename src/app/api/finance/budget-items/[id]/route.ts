import { and, eq, gt, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { type BudgetItem, budgetItem, budgetItemMonth } from "@/db/schema";
import {
  appliesIn,
  getBudgetSnapshot,
  ownsCategory,
  postMonthIfDue,
  valuesIn,
  valuesOf,
} from "@/lib/finance";
import { addMonths, monthBounds, monthOf } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";
import { budgetItemInput, monthKey } from "@/lib/validation";

/** With `month` the change is for that month only; without it, for the default from next month on. */
const updateSchema = budgetItemInput.extend({
  month: monthKey.optional(),
  repeats: z.boolean().optional(),
  view: monthKey,
});

const deleteSchema = z.object({
  month: monthKey.optional(),
  view: monthKey,
});

type RouteContext = { params: Promise<{ id: string }> };

async function findItem(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(budgetItem)
    .where(and(eq(budgetItem.id, id), eq(budgetItem.userId, userId)));
  return row;
}

async function findOverride(itemId: string, month: string) {
  const [row] = await db
    .select()
    .from(budgetItemMonth)
    .where(
      and(
        eq(budgetItemMonth.budgetItemId, itemId),
        eq(budgetItemMonth.month, month),
      ),
    );
  return row;
}

/** Saves `values` as the item's own copy for `month`. */
async function saveMonth(
  item: BudgetItem,
  month: string,
  values: ReturnType<typeof valuesOf>,
  removed = false,
) {
  await db
    .insert(budgetItemMonth)
    .values({
      ...values,
      userId: item.userId,
      budgetItemId: item.id,
      month,
      removed,
    })
    .onConflictDoUpdate({
      target: [budgetItemMonth.budgetItemId, budgetItemMonth.month],
      set: { ...values, removed, updatedAt: new Date() },
    });
}

/** Copies the item's current values into every month up to `through` that has no copy yet. */
async function freezeThrough(item: BudgetItem, through: string) {
  const last =
    item.endMonth && item.endMonth < through ? item.endMonth : through;
  const months: string[] = [];
  for (
    let month = monthOf(item.startDate);
    month <= last;
    month = addMonths(month, 1)
  ) {
    months.push(month);
  }
  if (!months.length) return;
  await db
    .insert(budgetItemMonth)
    .values(
      months.map((month) => ({
        ...valuesOf(item),
        userId: item.userId,
        budgetItemId: item.id,
        month,
      })),
    )
    .onConflictDoNothing();
}

/** Lets bill posting revisit months after `month` once an item runs past it again. */
function rewind(postedThrough: string | null, month: string) {
  const { end } = monthBounds(month);
  return postedThrough && postedThrough > end ? end : postedThrough;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Invalid budget item update." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const item = await findItem(userId, id);

  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const { month, repeats, view, ...fields } = parsed.data;
  const values = {
    name: fields.name,
    amountCents: fields.amountCents,
    categoryId: fields.categoryId ?? null,
    dueDay: fields.dueDay ?? null,
    notes: fields.notes || null,
  };
  const today = todayIn(await getTimeZone());
  const current = monthOf(today);
  const updatedAt = new Date();

  if (!month) {
    // The default changes from next month on; this month and earlier keep what they had.
    if (!item.repeats) {
      return NextResponse.json(
        { error: "Only repeating items are defaults." },
        { status: 400 },
      );
    }
    await freezeThrough(item, current);
    await db
      .update(budgetItem)
      .set({ ...values, updatedAt })
      .where(eq(budgetItem.id, id));
    return NextResponse.json(await getBudgetSnapshot(userId, view, today));
  }

  if (!appliesIn(item, month)) {
    return NextResponse.json(
      { error: "That item isn't in this month." },
      { status: 400 },
    );
  }

  const before = valuesIn(item, await findOverride(id, month));
  const first = monthOf(item.startDate);

  if (!item.repeats) {
    await db
      .update(budgetItem)
      .set({
        ...values,
        ...(repeats
          ? {
              repeats: true,
              endMonth: null,
              postedThrough: rewind(item.postedThrough, first),
            }
          : {}),
        updatedAt,
      })
      .where(eq(budgetItem.id, id));
  } else if (repeats === false && month === first) {
    await db
      .update(budgetItem)
      .set({ ...values, repeats: false, endMonth: null, updatedAt })
      .where(eq(budgetItem.id, id));
    await db
      .delete(budgetItemMonth)
      .where(eq(budgetItemMonth.budgetItemId, id));
  } else {
    await saveMonth(item, month, values);
    if (repeats && item.endMonth === month) {
      await db
        .update(budgetItem)
        .set({
          endMonth: null,
          postedThrough: rewind(item.postedThrough, month),
          updatedAt,
        })
        .where(eq(budgetItem.id, id));
    } else if (repeats === false) {
      await db
        .update(budgetItem)
        .set({ endMonth: month, updatedAt })
        .where(eq(budgetItem.id, id));
      await db
        .delete(budgetItemMonth)
        .where(
          and(
            eq(budgetItemMonth.budgetItemId, id),
            gt(budgetItemMonth.month, month),
          ),
        );
    }
  }

  if (before?.dueDay !== values.dueDay && month <= current) {
    await postMonthIfDue(userId, id, month, today);
  }

  return NextResponse.json(await getBudgetSnapshot(userId, view, today));
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = new URL(request.url).searchParams;
  const parsed = deleteSchema.safeParse({
    month: search.get("month") ?? undefined,
    view: search.get("view"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  }

  const { id } = await params;
  const item = await findItem(userId, id);

  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const { month, view } = parsed.data;
  const today = todayIn(await getTimeZone());
  const current = monthOf(today);
  const first = monthOf(item.startDate);

  if (month) {
    if (!item.repeats) {
      await db.delete(budgetItem).where(eq(budgetItem.id, id));
    } else {
      const values = valuesIn(item, await findOverride(id, month));
      await saveMonth(item, month, values ?? valuesOf(item), true);
    }
  } else if (first > current) {
    await db.delete(budgetItem).where(eq(budgetItem.id, id));
  } else {
    // Stops after this month; this month and earlier keep the item.
    await db
      .update(budgetItem)
      .set({ endMonth: current, updatedAt: new Date() })
      .where(
        and(
          eq(budgetItem.id, id),
          or(isNull(budgetItem.endMonth), gt(budgetItem.endMonth, current)),
        ),
      );
  }

  return NextResponse.json(await getBudgetSnapshot(userId, view, today));
}
