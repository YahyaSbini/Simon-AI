import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { calendarEventCompletion } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { calendarEventIdInput } from "@/lib/validation";

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = calendarEventIdInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  await db
    .insert(calendarEventCompletion)
    .values({ userId, eventId: parsed.data.eventId })
    .onConflictDoNothing();

  return NextResponse.json({ completed: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = calendarEventIdInput.safeParse({
    eventId: new URL(request.url).searchParams.get("eventId"),
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
      ),
    );

  return new NextResponse(null, { status: 204 });
}
