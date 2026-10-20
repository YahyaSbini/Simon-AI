import { NextResponse } from "next/server";
import { activityUsage, importActivities } from "@/lib/activities";
import { getActivities } from "@/lib/data";
import { requireUserId } from "@/lib/session";

/** Create activities from existing Day Structure blocks and link them. */
export async function POST() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const linked = await importActivities(userId);
  const [activities, usage] = await Promise.all([
    getActivities(userId),
    activityUsage(userId),
  ]);

  return NextResponse.json({ linked, activities, usage });
}
