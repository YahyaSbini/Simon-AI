import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { timeSectionItem } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { timeSectionItemInput } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = timeSectionItemInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Write the item." }, { status: 400 });
  }

  const { id } = await params;
  const [updated] = await db
    .update(timeSectionItem)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(timeSectionItem.id, id), eq(timeSectionItem.userId, userId)))
    .returning({ id: timeSectionItem.id, text: timeSectionItem.text });

  if (!updated) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(timeSectionItem)
    .where(and(eq(timeSectionItem.id, id), eq(timeSectionItem.userId, userId)))
    .returning({ id: timeSectionItem.id });

  if (!deleted) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
