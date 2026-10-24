import { and, asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { list, task } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { resolveLinks } from "@/lib/task-links";
import { dateKey, minutes, taskType, timestamp } from "@/lib/validation";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
  listId: z.string().uuid().nullish(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
  estimatedMinutes: minutes,
  type: taskType,
  parentTaskId: z.string().uuid().nullish(),
  activityId: z.string().uuid().nullish(),
  dueAt: timestamp.nullish(),
  myDayDate: dateKey.nullish(),
});

export async function GET(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listId = new URL(request.url).searchParams.get("listId");

  const tasks = await db
    .select()
    .from(task)
    .where(
      listId
        ? and(eq(task.userId, userId), eq(task.listId, listId))
        : eq(task.userId, userId),
    )
    .orderBy(asc(task.position), desc(task.createdAt));

  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createTaskSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the task a title, a time in minutes and a type." },
      { status: 400 },
    );
  }

  const { listId, parentTaskId, activityId, ...fields } = parsed.data;

  const links = await resolveLinks(userId, "task", null, {
    type: fields.type,
    parentId: parentTaskId ?? null,
    activityId: activityId ?? null,
  });

  if ("error" in links) {
    return NextResponse.json({ error: links.error }, { status: links.status });
  }

  if (listId) {
    const [owned] = await db
      .select({ id: list.id })
      .from(list)
      .where(and(eq(list.id, listId), eq(list.userId, userId)));

    if (!owned) {
      return NextResponse.json({ error: "List not found." }, { status: 404 });
    }
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${task.position}), -1) + 1` })
    .from(task)
    .where(eq(task.userId, userId));

  const [created] = await db
    .insert(task)
    .values({
      ...fields,
      parentTaskId: links.parentId,
      activityId: links.activityId,
      listId: listId ?? null,
      userId,
      position: next,
    })
    .returning();

  return NextResponse.json({ task: created }, { status: 201 });
}
