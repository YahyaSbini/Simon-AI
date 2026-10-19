import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { reorderItems } from "@/lib/time-sections";
import { reorderInput } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reorderInput.safeParse(await request.json());
  const { id: sectionId } = await params;

  if (
    !parsed.success ||
    !(await reorderItems(userId, sectionId, parsed.data.ids))
  ) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
