import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { getLinkTargets } from "@/lib/task-links";

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getLinkTargets(userId));
}
