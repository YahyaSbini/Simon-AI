import { NextResponse } from "next/server";
import { db } from "@/db";
import { financeEntry } from "@/db/schema";
import { ownsCategory, serializeEntry } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { entryInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = entryInput.safeParse(await request.json());

  if (
    !parsed.success ||
    !(await ownsCategory(userId, parsed.data.categoryId))
  ) {
    return NextResponse.json(
      { error: "Check the amount, date and category." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(financeEntry)
    .values({ ...parsed.data, note: parsed.data.note || null, userId })
    .returning();

  return NextResponse.json({ entry: serializeEntry(created) }, { status: 201 });
}
