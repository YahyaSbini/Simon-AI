import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityGroupMember } from "@/db/schema";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, memberId } = await params;
  const [deleted] = await db
    .delete(activityGroupMember)
    .where(
      and(
        eq(activityGroupMember.id, memberId),
        eq(activityGroupMember.groupId, id),
        eq(activityGroupMember.userId, userId),
      ),
    )
    .returning({ id: activityGroupMember.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
