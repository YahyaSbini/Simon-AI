import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { financeSettings } from "@/db/schema";
import { getCurrency } from "@/lib/finance";
import { requireUserId } from "@/lib/session";
import { financeSettingsInput } from "@/lib/validation";

export async function PATCH(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = financeSettingsInput.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a currency." }, { status: 400 });
  }

  await getCurrency(userId);
  await db
    .update(financeSettings)
    .set({ currency: parsed.data.currency, updatedAt: new Date() })
    .where(eq(financeSettings.userId, userId));

  return NextResponse.json({ currency: parsed.data.currency });
}
