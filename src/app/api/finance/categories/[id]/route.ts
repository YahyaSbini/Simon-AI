import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { financeCategory } from "@/db/schema";
import { serializeCategory } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { categoryInput } from "@/lib/validation";

const updateSchema = categoryInput.pick({ name: true });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the category a name." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const [updated] = await db
    .update(financeCategory)
    .set(parsed.data)
    .where(and(eq(financeCategory.id, id), eq(financeCategory.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json({ category: serializeCategory(updated) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(financeCategory)
    .where(and(eq(financeCategory.id, id), eq(financeCategory.userId, userId)))
    .returning({ id: financeCategory.id });

  if (!deleted) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
