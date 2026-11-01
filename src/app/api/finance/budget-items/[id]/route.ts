import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { budgetItem } from "@/db/schema";
import { ownsCategory, serializeBudgetItem } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { budgetItemUpdate } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = budgetItemUpdate.safeParse(await request.json());

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
  const [updated] = await db
    .update(budgetItem)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(budgetItem.id, id), eq(budgetItem.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ item: serializeBudgetItem(updated) });
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
