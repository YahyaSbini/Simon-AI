import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { financeEntry } from "@/db/schema";
import { ownsCategory, serializeEntry } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { entryInput } from "@/lib/validation";

const updateSchema = entryInput.partial();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Invalid entry update." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const patch =
    parsed.data.note !== undefined
      ? { ...parsed.data, note: parsed.data.note || null }
      : parsed.data;
  const [updated] = await db
    .update(financeEntry)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(financeEntry.id, id), eq(financeEntry.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ entry: serializeEntry(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(financeEntry)
    .where(and(eq(financeEntry.id, id), eq(financeEntry.userId, userId)))
    .returning({ id: financeEntry.id });

  if (!deleted) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
