import { NextResponse } from "next/server";
import { db } from "@/db";
import { timeSection } from "@/db/schema";
import { getTimeSections } from "@/lib/data";
import { requireUserId } from "@/lib/session";
import { nextSectionPosition } from "@/lib/time-sections";
import { timeSectionInput } from "@/lib/validation";

export async function GET() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ sections: await getTimeSections(userId) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = timeSectionInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the section a title." },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(timeSection)
    .values({
      ...parsed.data,
      userId,
      position: await nextSectionPosition(userId),
    })
    .returning();

  return NextResponse.json(
    { section: { id: created.id, title: created.title, items: [] } },
    { status: 201 },
  );
}
