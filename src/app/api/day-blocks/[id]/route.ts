import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dayBlock } from "@/db/schema";
import { serializeDayBlock } from "@/lib/data";
import { requireUserId } from "@/lib/session";
import { dayBlockInput } from "@/lib/validation";

const updateSchema = dayBlockInput.partial();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid block update." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const [updated] = await db
    .update(dayBlock)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(dayBlock.id, id), eq(dayBlock.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Block not found." }, { status: 404 });
  }

  return NextResponse.json({ block: serializeDayBlock(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(dayBlock)
    .where(and(eq(dayBlock.id, id), eq(dayBlock.userId, userId)))
    .returning({ id: dayBlock.id });

  if (!deleted) {
    return NextResponse.json({ error: "Block not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
