import { NextResponse } from "next/server";
import { db } from "@/db";
import { activity } from "@/db/schema";
import { nextActivityPosition, serializeActivity } from "@/lib/activities";
import { getActivities } from "@/lib/data";
import { requireUserId } from "@/lib/session";
import { activityInput } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ activities: await getActivities(userId) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = activityInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the activity a name and a color." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(activity)
    .values({
      ...parsed.data,
      emoji: parsed.data.emoji || null,
      userId,
      position: await nextActivityPosition(userId),
    })
    .returning();

  return NextResponse.json(
    { activity: serializeActivity(created) },
    { status: 201 },
  );
}
