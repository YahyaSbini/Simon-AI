import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { routine } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { routineInput } from "@/lib/validation";

const updateRoutineSchema = routineInput.partial();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateRoutineSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid routine update." },
      { status: 400 },
    );
  }

  const { id } = await params;

  const [updated] = await db
    .update(routine)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(routine.id, id), eq(routine.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }

  return NextResponse.json({ routine: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(routine)
    .where(and(eq(routine.id, id), eq(routine.userId, userId)))
    .returning({ id: routine.id });

  if (!deleted) {
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
