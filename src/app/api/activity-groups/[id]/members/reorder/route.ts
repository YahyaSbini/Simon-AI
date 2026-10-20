import { NextResponse } from "next/server";
import { reorderMembers } from "@/lib/activity-groups";
import { requireUserId } from "@/lib/session";
import { reorderInput } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = reorderInput.safeParse(await request.json());

  if (!parsed.success || !(await reorderMembers(userId, id, parsed.data.ids))) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
