import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityGroupMember } from "@/db/schema";
import { findGroup, nextMemberPosition } from "@/lib/activity-groups";
import { findActivity } from "@/lib/activities";
import { requireUserId } from "@/lib/session";
import { groupMemberInput } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const group = await findGroup(userId, id);

  if (!group) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = groupMemberInput.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await findActivity(userId, parsed.data.activityId))
  ) {
    return NextResponse.json(
      { error: "Choose one of your activities." },
      { status: 400 },
    );
  }

  const { activityId } = parsed.data;

  if (activityId === group.activityId) {
    return NextResponse.json(
      { error: "An activity can't be added under itself." },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: activityGroupMember.id })
    .from(activityGroupMember)
    .where(
      and(
        eq(activityGroupMember.groupId, id),
        eq(activityGroupMember.activityId, activityId),
      ),
    );

  if (existing) {
    return NextResponse.json({ error: "Already added." }, { status: 409 });
  }

  const [created] = await db
    .insert(activityGroupMember)
    .values({
      userId,
      groupId: id,
      activityId,
      position: await nextMemberPosition(id),
    })
    .returning({
      id: activityGroupMember.id,
      activityId: activityGroupMember.activityId,
    });

  return NextResponse.json({ member: created }, { status: 201 });
}
