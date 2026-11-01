import { NextResponse } from "next/server";
import { db } from "@/db";
import { moneyItem } from "@/db/schema";
import { ownsCategory } from "@/lib/finance";
import { fillItem, serializeMoneyItem } from "@/lib/money-items";
import { requireUserId } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";
import { moneyItemInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = moneyItemInput.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Check the item's name, amount, day and month." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(moneyItem)
    .values({ ...parsed.data, userId })
    .returning();
  await fillItem(created, todayIn(await getTimeZone()));

  return NextResponse.json(
    { item: serializeMoneyItem(created) },
    { status: 201 },
  );
}
