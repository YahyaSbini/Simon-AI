import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { budgetItem, moneyItem } from "@/db/schema";
import { ownsCategory, serializeBudgetItem } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { budgetItemInput, budgetPickInput } from "@/lib/validation";

/** Adds one item by hand, or copies picked In/Out items, into a month's budget. */
export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const picked = budgetPickInput.safeParse(body);

  if (picked.success) {
    const { month, moneyItemIds } = picked.data;
    const [sources, existing] = await Promise.all([
      db
        .select()
        .from(moneyItem)
        .where(
          and(
            eq(moneyItem.userId, userId),
            inArray(moneyItem.id, moneyItemIds),
          ),
        ),
      db
        .select({ moneyItemId: budgetItem.moneyItemId })
        .from(budgetItem)
        .where(and(eq(budgetItem.userId, userId), eq(budgetItem.month, month))),
    ]);
    const added = new Set(existing.map((row) => row.moneyItemId));
    const fresh = sources.filter((item) => !added.has(item.id));
    const created = fresh.length
      ? await db
          .insert(budgetItem)
          .values(
            fresh.map((item) => ({
              userId,
              month,
              kind: item.kind,
              name: item.name,
              categoryId: item.categoryId,
              amountCents: item.amountCents,
              moneyItemId: item.id,
            })),
          )
          .returning()
      : [];
    return NextResponse.json(
      { items: created.map(serializeBudgetItem) },
      { status: 201 },
    );
  }

  const parsed = budgetItemInput.safeParse(body);

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Check the item's name and amount." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(budgetItem)
    .values({ ...parsed.data, userId })
    .returning();

  return NextResponse.json(
    { items: [serializeBudgetItem(created)] },
    { status: 201 },
  );
}
