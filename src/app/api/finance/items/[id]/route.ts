import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { moneyItem } from "@/db/schema";
import { ownsCategory } from "@/lib/finance";
import {
  deleteMoneyItem,
  serializeMoneyItem,
  updateMoneyItem,
} from "@/lib/money-items";
import { requireUserId } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";
import { moneyItemUpdate } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

async function findItem(userId: string, id: string) {
  const [item] = await db
    .select()
    .from(moneyItem)
    .where(and(eq(moneyItem.id, id), eq(moneyItem.userId, userId)));
  return item;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = moneyItemUpdate.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Invalid item update." },
      { status: 400 },
    );
  }

  const item = await findItem(userId, (await params).id);

  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const today = todayIn(await getTimeZone());
  const updated = await updateMoneyItem(item, parsed.data, today);

  return NextResponse.json({ item: serializeMoneyItem(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await findItem(userId, (await params).id);

  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  await deleteMoneyItem(item, todayIn(await getTimeZone()));

  return NextResponse.json({ ok: true });
}
