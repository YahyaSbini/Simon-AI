import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { routine } from "@/db/schema";
import { today } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { routineInput, validDateRange } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const routines = await db
    .select()
    .from(routine)
    .where(eq(routine.userId, userId))
    .orderBy(asc(routine.position), asc(routine.timeOfDay), asc(routine.createdAt));

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

  const startDate = parsed.data.startDate ?? today();

  if (!validDateRange({ startDate, endDate: parsed.data.endDate })) {
    return NextResponse.json(
      { error: "The end date must not be before the start date." },
      { status: 400 },
    );
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${routine.position}), -1) + 1` })
    .from(routine)
    .where(eq(routine.userId, userId));

  const [created] = await db
    .insert(routine)
    .values({ ...parsed.data, startDate, userId, position: next })
    .returning();

  return NextResponse.json({ routine: created }, { status: 201 });
}
