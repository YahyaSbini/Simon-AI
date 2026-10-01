import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { financeCategory } from "@/db/schema";
import { serializeCategory } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { categoryInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = categoryInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the category a name." },
      { status: 400 },
    );
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(financeCategory)
    .where(eq(financeCategory.userId, userId));

  const [created] = await db
    .insert(financeCategory)
    .values({ ...parsed.data, userId, position: total })
    .returning();

  return NextResponse.json(
    { category: serializeCategory(created) },
    { status: 201 },
  );
}
