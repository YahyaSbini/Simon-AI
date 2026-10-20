import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityGroup } from "@/db/schema";
import {
  getActivityGroups,
  nextGroupPosition,
  serializeGroup,
} from "@/lib/activity-groups";
import { findActivity } from "@/lib/activities";
import { requireUserId } from "@/lib/session";
import { activityGroupInput } from "@/lib/validation";

export async function GET(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = new URL(request.url).searchParams.get("kind");

  if (kind !== "investment" && kind !== "hobby") {
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  }

  return NextResponse.json({ groups: await getActivityGroups(userId, kind) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = activityGroupInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose an activity or give the category a name." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const position = await nextGroupPosition(userId, input.kind);

  if (input.kind === "investment") {
    if (!(await findActivity(userId, input.activityId))) {
      return NextResponse.json(
        { error: "Choose one of your activities." },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ id: activityGroup.id })
      .from(activityGroup)
      .where(
        and(
          eq(activityGroup.activityId, input.activityId),
          eq(activityGroup.userId, userId),
        ),
      );

    if (existing) {
      return NextResponse.json(
        { error: "That activity is already in Time Investment." },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(activityGroup)
      .values({
        userId,
        kind: "investment",
        activityId: input.activityId,
        position,
      })
      .returning();
    return NextResponse.json(
      { group: serializeGroup(created) },
      { status: 201 },
    );
  }

  const [created] = await db
    .insert(activityGroup)
    .values({
      userId,
      kind: "hobby",
      name: input.name,
      emoji: input.emoji || null,
      position,
    })
    .returning();
  return NextResponse.json({ group: serializeGroup(created) }, { status: 201 });
}
