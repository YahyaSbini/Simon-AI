import { and, eq, gt } from "drizzle-orm";
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

const updateSchema = budgetItemInput.partial();

type RouteContext = { params: Promise<{ id: string }> };

function dayBefore(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
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
  const [current] = await db
    .select()
    .from(budgetItem)
    .where(and(eq(budgetItem.id, id), eq(budgetItem.userId, userId)));

  if (!current) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const today = todayIn(await getTimeZone());
  const rescheduled =
    parsed.data.dueDay !== undefined && parsed.data.dueDay !== current.dueDay;
  const resumeFrom = dayBefore(today);
  const [updated] = await db
    .update(budgetItem)
    .set({
      ...parsed.data,
      ...(rescheduled &&
      (!current.postedThrough || current.postedThrough < resumeFrom)
        ? { postedThrough: resumeFrom }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(budgetItem.id, id))
    .returning();

  if (rescheduled) await postDueBills(userId, today);
  const posted = rescheduled
    ? await db
        .select()
        .from(financeEntry)
        .where(
          and(
            eq(financeEntry.budgetItemId, id),
            gt(financeEntry.date, resumeFrom),
          ),
        )
    : [];

  return NextResponse.json({
    item: serializeBudgetItem(updated),
    posted: posted.map(serializeEntry),
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(budgetItem)
    .where(and(eq(budgetItem.id, id), eq(budgetItem.userId, userId)))
    .returning({ id: budgetItem.id });

  if (!deleted) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
