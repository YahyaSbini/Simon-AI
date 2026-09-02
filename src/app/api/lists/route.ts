import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { list } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const createListSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lists = await db
    .select()
    .from(list)
    .where(eq(list.userId, userId))
    .orderBy(asc(list.position), asc(list.createdAt));

  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createListSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the list a name of 1–80 characters." },
      { status: 400 },
    );
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${list.position}), -1) + 1` })
    .from(list)
    .where(eq(list.userId, userId));

  const [created] = await db
    .insert(list)
    .values({ name: parsed.data.name, userId, position: next })
    .returning();

  return NextResponse.json({ list: created }, { status: 201 });
}
