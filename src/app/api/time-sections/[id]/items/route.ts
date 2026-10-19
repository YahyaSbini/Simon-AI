import { NextResponse } from "next/server";
import { db } from "@/db";
import { timeSectionItem } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { nextItemPosition, ownsSection } from "@/lib/time-sections";
import { timeSectionItemInput } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = timeSectionItemInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Write the item." }, { status: 400 });
  }

  const { id: sectionId } = await params;

  if (!(await ownsSection(userId, sectionId))) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const [created] = await db
    .insert(timeSectionItem)
    .values({
      ...parsed.data,
      userId,
      sectionId,
      position: await nextItemPosition(sectionId),
    })
    .returning({ id: timeSectionItem.id, text: timeSectionItem.text });

  return NextResponse.json({ item: created }, { status: 201 });
}
