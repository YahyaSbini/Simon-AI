import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityGroup } from "@/db/schema";
import { findGroup, serializeGroup } from "@/lib/activity-groups";
import { requireUserId } from "@/lib/session";
import { activityGroupUpdate } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const group = await findGroup(userId, id);

  if (!group || group.kind !== "hobby") {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const parsed = activityGroupUpdate.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the category a name." },
      { status: 400 },
    );
  }

  const { name, emoji } = parsed.data;
  const [updated] = await db
    .update(activityGroup)
    .set({
      ...(name !== undefined && { name }),
      ...(emoji !== undefined && { emoji: emoji || null }),
      updatedAt: new Date(),
    })
    .where(and(eq(activityGroup.id, id), eq(activityGroup.userId, userId)))
    .returning();

  return NextResponse.json({ group: serializeGroup(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(activityGroup)
    .where(and(eq(activityGroup.id, id), eq(activityGroup.userId, userId)))
    .returning({ id: activityGroup.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
