import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { timeSection } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { timeSectionUpdate } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = timeSectionUpdate.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the section a title." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const [updated] = await db
    .update(timeSection)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(timeSection.id, id), eq(timeSection.userId, userId)))
    .returning({
      id: timeSection.id,
      title: timeSection.title,
      collapsed: timeSection.collapsed,
    });

  if (!updated) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  return NextResponse.json({ section: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(timeSection)
    .where(and(eq(timeSection.id, id), eq(timeSection.userId, userId)))
    .returning({ id: timeSection.id });

  if (!deleted) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
