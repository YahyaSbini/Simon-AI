import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { task, taskStep } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const createStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createStepSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the step a title of 1–200 characters." },
      { status: 400 },
    );
  }

  const { id } = await params;

  const [owned] = await db
    .select({ id: task.id })
    .from(task)
    .where(and(eq(task.id, id), eq(task.userId, userId)));

  if (!owned) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${taskStep.position}), -1) + 1` })
    .from(taskStep)
    .where(eq(taskStep.taskId, id));

  const [created] = await db
    .insert(taskStep)
    .values({ taskId: id, title: parsed.data.title, position: next })
    .returning();

  return NextResponse.json({ step: created }, { status: 201 });
}
