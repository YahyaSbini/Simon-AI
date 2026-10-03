import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { calendarEventCompletion } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { calendarCompletionInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = calendarCompletionInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  await db
    .insert(calendarEventCompletion)
    .values({ userId, eventId: parsed.data.eventId, date: parsed.data.date })
    .onConflictDoNothing();

  return NextResponse.json({ completed: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams;
  const parsed = calendarCompletionInput.safeParse({
    eventId: query.get("eventId"),
    date: query.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  await db
    .delete(calendarEventCompletion)
    .where(
      and(
        eq(calendarEventCompletion.userId, userId),
        eq(calendarEventCompletion.eventId, parsed.data.eventId),
        eq(calendarEventCompletion.date, parsed.data.date),
      ),
    );

  return new NextResponse(null, { status: 204 });
}
