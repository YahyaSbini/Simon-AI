import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { budgetItem, financeEntry } from "@/db/schema";
import {
  ownsCategory,
  postDueBills,
  serializeBudgetItem,
  serializeEntry,
} from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";
import { budgetItemInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = budgetItemInput.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Check the item's name, amount and day." },
      { status: 400 },
    );
  }

  const today = todayIn(await getTimeZone());
  const [created] = await db
    .insert(budgetItem)
    .values({ ...parsed.data, userId, startDate: today })
    .returning();

  await postDueBills(userId, today);
  const posted = await db
    .select()
    .from(financeEntry)
    .where(
      and(
        eq(financeEntry.userId, userId),
        eq(financeEntry.budgetItemId, created.id),
      ),
    );

  return NextResponse.json(
    { item: serializeBudgetItem(created), posted: posted.map(serializeEntry) },
    { status: 201 },
  );
}
