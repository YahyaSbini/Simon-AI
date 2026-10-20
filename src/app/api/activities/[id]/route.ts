import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activity, dayBlock } from "@/db/schema";
import { blockFieldsOf, serializeActivity } from "@/lib/activities";
import { requireUserId } from "@/lib/session";
import { activityUpdate } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = activityUpdate.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid activity update." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const patch =
    parsed.data.emoji === undefined
      ? parsed.data
      : { ...parsed.data, emoji: parsed.data.emoji || null };

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(activity)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(activity.id, id), eq(activity.userId, userId)))
      .returning();
    if (!row) return null;

    await tx
      .update(dayBlock)
      .set({ ...blockFieldsOf(row), updatedAt: new Date() })
      .where(and(eq(dayBlock.activityId, id), eq(dayBlock.userId, userId)));
    return row;
  });

  if (!updated) {
    return NextResponse.json({ error: "Activity not found." }, { status: 404 });
  }

  return NextResponse.json({ activity: serializeActivity(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [usage] = await db
    .select({ uses: count() })
    .from(dayBlock)
    .where(and(eq(dayBlock.activityId, id), eq(dayBlock.userId, userId)));

  if (usage && usage.uses > 0) {
    return NextResponse.json(
      {
        error: `Used by ${usage.uses} block${usage.uses === 1 ? "" : "s"} in Day Structure. Remove them first.`,
      },
      { status: 409 },
    );
  }

  const [deleted] = await db
    .delete(activity)
    .where(and(eq(activity.id, id), eq(activity.userId, userId)))
    .returning({ id: activity.id });

  if (!deleted) {
    return NextResponse.json({ error: "Activity not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
