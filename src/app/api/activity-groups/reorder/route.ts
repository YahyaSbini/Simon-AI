import { NextResponse } from "next/server";
import { reorderGroups } from "@/lib/activity-groups";
import { requireUserId } from "@/lib/session";
import { activityGroupReorder } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = activityGroupReorder.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await reorderGroups(userId, parsed.data.kind, parsed.data.ids))
  ) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
