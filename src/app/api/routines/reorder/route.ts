import { NextResponse } from "next/server";
import { routine } from "@/db/schema";
import { reorderRows } from "@/lib/reorder";
import { requireUserId } from "@/lib/session";
import { reorderInput } from "@/lib/validation";

export async function PATCH(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reorderInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  const ok = await reorderRows(routine, userId, parsed.data.ids);

  if (!ok) {
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
