import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { savingsGoal } from "@/db/schema";
import { serializeSavingsGoal } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { savingsGoalInput } from "@/lib/validation";

const updateSchema = savingsGoalInput.partial();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid goal update." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const [updated] = await db
    .update(savingsGoal)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(savingsGoal.id, id), eq(savingsGoal.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }

  return NextResponse.json({ goal: serializeSavingsGoal(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(savingsGoal)
    .where(and(eq(savingsGoal.id, id), eq(savingsGoal.userId, userId)))
    .returning({ id: savingsGoal.id });

  if (!deleted) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
