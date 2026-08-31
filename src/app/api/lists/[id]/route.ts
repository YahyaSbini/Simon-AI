import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { list } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const updateListSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateListSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid list name." }, { status: 400 });
  }

  const { id } = await params;

  const [updated] = await db
    .update(list)
    .set({ name: parsed.data.name })
    .where(and(eq(list.id, id), eq(list.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  return NextResponse.json({ list: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(list)
    .where(and(eq(list.id, id), eq(list.userId, userId)))
    .returning({ id: list.id });

  if (!deleted) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
