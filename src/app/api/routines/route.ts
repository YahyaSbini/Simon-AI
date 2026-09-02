import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { routine } from "@/db/schema";
import { today } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { routineInput } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const routines = await db
    .select()
    .from(routine)
    .where(eq(routine.userId, userId))
    .orderBy(asc(routine.timeOfDay), asc(routine.createdAt));

  return NextResponse.json({ routines });
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = routineInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the routine's title and repeat rule." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(routine)
    .values({
      ...parsed.data,
      startDate: parsed.data.startDate ?? today(),
      userId,
    })
    .returning();

  return NextResponse.json({ routine: created }, { status: 201 });
}
