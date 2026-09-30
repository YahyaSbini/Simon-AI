import { NextResponse } from "next/server";
import { db } from "@/db";
import { dayBlock } from "@/db/schema";
import { getDayBlocks, serializeDayBlock } from "@/lib/data";
import { requireUserId } from "@/lib/session";
import { dayBlockInput } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ blocks: await getDayBlocks(userId) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = dayBlockInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the block's days, times and label." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(dayBlock)
    .values({ ...parsed.data, userId })
    .returning();

  return NextResponse.json(
    { block: serializeDayBlock(created) },
    { status: 201 },
  );
}
