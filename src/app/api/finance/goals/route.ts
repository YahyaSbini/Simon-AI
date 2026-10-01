import { NextResponse } from "next/server";
import { db } from "@/db";
import { savingsGoal } from "@/db/schema";
import { serializeSavingsGoal } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { savingsGoalInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = savingsGoalInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the goal's name, target and date." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(savingsGoal)
    .values({ ...parsed.data, userId })
    .returning();

  return NextResponse.json(
    { goal: serializeSavingsGoal(created) },
    { status: 201 },
  );
}
