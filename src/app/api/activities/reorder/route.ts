import { NextResponse } from "next/server";
import { reorderActivities } from "@/lib/activities";
import { requireUserId } from "@/lib/session";
import { reorderInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reorderInput.safeParse(await request.json());

  if (!parsed.success || !(await reorderActivities(userId, parsed.data.ids))) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
