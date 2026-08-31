import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { task } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
  dueAt: z.coerce.date().optional(),
});

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await db
    .select()
    .from(task)
    .where(eq(task.userId, userId))
    .orderBy(desc(task.createdAt));

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
      { error: "Give the task a title of 1–200 characters." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(task)
    .values({ ...parsed.data, userId })
    .returning();

  return NextResponse.json({ task: created }, { status: 201 });
}
