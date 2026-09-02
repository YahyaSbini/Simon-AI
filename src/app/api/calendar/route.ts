import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { account } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/session";

export async function DELETE() {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not connected" }, { status: 404 });
  }

  await auth.api.unlinkAccount({
    body: { accountId: row.id },
    headers: await headers(),
  });

  return NextResponse.json({ connected: false });
}
