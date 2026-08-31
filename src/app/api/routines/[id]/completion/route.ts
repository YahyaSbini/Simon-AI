import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { routine, routineCompletion } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const completionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type RouteContext = { params: Promise<{ id: string }> };

async function ownedRoutine(id: string, userId: string) {
  const [owned] = await db
    .select({ id: routine.id })
    .from(routine)
    .where(and(eq(routine.id, id), eq(routine.userId, userId)));

  return owned;
}

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = completionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const { id } = await params;

  if (!(await ownedRoutine(id, userId))) {
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }

  const [created] = await db
    .insert(routineCompletion)
    .values({ routineId: id, date: parsed.data.date })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json({ completion: created ?? null }, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = completionSchema.safeParse({
    date: new URL(request.url).searchParams.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const { id } = await params;

  if (!(await ownedRoutine(id, userId))) {
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }

  await db
    .delete(routineCompletion)
    .where(
      and(
        eq(routineCompletion.routineId, id),
        eq(routineCompletion.date, parsed.data.date),
      ),
    );

  return new NextResponse(null, { status: 204 });
}
