import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { routine } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { routineInput, validDateRange } from "@/lib/validation";

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

  if (parsed.data.startDate !== undefined || parsed.data.endDate !== undefined) {
    const [existing] = await db
      .select({ startDate: routine.startDate, endDate: routine.endDate })
      .from(routine)
      .where(and(eq(routine.id, id), eq(routine.userId, userId)));

    if (!existing) {
      return NextResponse.json({ error: "Routine not found." }, { status: 404 });
    }

    const merged = {
      startDate: parsed.data.startDate ?? existing.startDate,
      endDate:
        parsed.data.endDate === undefined ? existing.endDate : parsed.data.endDate,
    };

    if (!validDateRange(merged)) {
      return NextResponse.json(
        { error: "The end date must not be before the start date." },
        { status: 400 },
      );
    }
  }

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
