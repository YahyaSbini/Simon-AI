import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { budgetItem } from "@/db/schema";
import { getBudgetSnapshot, ownsCategory } from "@/lib/finance";
import { monthOf } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";
import { budgetItemInput, monthKey } from "@/lib/validation";

/** Without `month` the item is a default: it repeats from the current month on. */
const createSchema = budgetItemInput.extend({
  month: monthKey.optional(),
  repeats: z.boolean().optional(),
  view: monthKey,
});

export async function GET(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const view = monthKey.safeParse(
    new URL(request.url).searchParams.get("view"),
  );

  if (!view.success) {
    return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  }

  const today = todayIn(await getTimeZone());
  return NextResponse.json(await getBudgetSnapshot(userId, view.data, today));
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Check the item's name, amount and day." },
      { status: 400 },
    );
  }

  const { month, repeats, view, ...values } = parsed.data;
  const today = todayIn(await getTimeZone());
  await db.insert(budgetItem).values({
    ...values,
    notes: values.notes || null,
    userId,
    startDate: `${month ?? monthOf(today)}-01`,
    repeats: month ? (repeats ?? false) : true,
  });

  return NextResponse.json(await getBudgetSnapshot(userId, view, today), {
    status: 201,
  });
}
