import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { list, task } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullish(),
  listId: z.string().uuid().nullish(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullish(),
  dueAt: z.coerce.date().nullish(),
  myDayDate: dateKey.nullish(),
  completed: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateTaskSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task update." }, { status: 400 });
  }

  const { completed, ...fields } = parsed.data;
  const { id } = await params;

  if (fields.listId) {
    const [owned] = await db
      .select({ id: list.id })
      .from(list)
      .where(and(eq(list.id, fields.listId), eq(list.userId, userId)));

    if (!owned) {
      return NextResponse.json({ error: "List not found." }, { status: 404 });
    }
  }

  const [updated] = await db
    .update(task)
    .set({
      ...fields,
      ...(completed === undefined
        ? {}
        : { completedAt: completed ? new Date() : null }),
      updatedAt: new Date(),
    })
    .where(and(eq(task.id, id), eq(task.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(task)
    .where(and(eq(task.id, id), eq(task.userId, userId)))
    .returning({ id: task.id });

  if (!deleted) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
