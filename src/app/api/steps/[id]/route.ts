import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { task, taskStep } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const updateStepSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function ownedStepIds(userId: string) {
  return db
    .select({ id: taskStep.id })
    .from(taskStep)
    .innerJoin(task, eq(task.id, taskStep.taskId))
    .where(eq(task.userId, userId));
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

  const { completed, ...fields } = parsed.data;
  const { id } = await params;

  const [updated] = await db
    .update(taskStep)
    .set({
      ...fields,
      ...(completed === undefined
        ? {}
        : { completedAt: completed ? new Date() : null }),
    })
    .where(and(eq(taskStep.id, id), inArray(taskStep.id, ownedStepIds(userId))))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }

  return NextResponse.json({ step: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(taskStep)
    .where(and(eq(taskStep.id, id), inArray(taskStep.id, ownedStepIds(userId))))
    .returning({ id: taskStep.id });

  if (!deleted) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
