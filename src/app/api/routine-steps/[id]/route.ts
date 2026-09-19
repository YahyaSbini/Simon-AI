import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { routine, routineStep, routineStepCompletion } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { dateKey } from "@/lib/validation";

/** `completed` applies to the given `date` only; steps reset with each occurrence. */
const updateStepSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  date: dateKey.optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function ownedStepIds(userId: string) {
  return db
    .select({ id: routineStep.id })
    .from(routineStep)
    .innerJoin(routine, eq(routine.id, routineStep.routineId))
    .where(eq(routine.userId, userId));
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateStepSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid step update." }, { status: 400 });
  }

  const { completed, date, title } = parsed.data;

  if (completed !== undefined && !date) {
    return NextResponse.json(
      { error: "A date is required to tick a step." },
      { status: 400 },
    );
  }

  const { id } = await params;

  const [step] = await db
    .select()
    .from(routineStep)
    .where(
      and(eq(routineStep.id, id), inArray(routineStep.id, ownedStepIds(userId))),
    );

  if (!step) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }

  if (title !== undefined) {
    await db.update(routineStep).set({ title }).where(eq(routineStep.id, id));
  }

  if (completed !== undefined && date) {
    if (completed) {
      await db
        .insert(routineStepCompletion)
        .values({ stepId: id, date })
        .onConflictDoNothing();
    } else {
      await db
        .delete(routineStepCompletion)
        .where(
          and(
            eq(routineStepCompletion.stepId, id),
            eq(routineStepCompletion.date, date),
          ),
        );
    }
  }

  return NextResponse.json({ step: { ...step, title: title ?? step.title } });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(routineStep)
    .where(
      and(eq(routineStep.id, id), inArray(routineStep.id, ownedStepIds(userId))),
    )
    .returning({ id: routineStep.id });

  if (!deleted) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
