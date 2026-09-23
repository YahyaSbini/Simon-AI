import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { account } from "@/db/schema";
import { requireUserId } from "@/lib/session";

export async function DELETE() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await db
    .delete(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
    .returning({ id: account.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not connected" }, { status: 404 });
  }

  return NextResponse.json({ connected: false });
}
