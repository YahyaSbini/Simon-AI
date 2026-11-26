import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiKey, getApiKeys } from "@/lib/api-keys";
import { getSession } from "@/lib/session";

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(60),
  timeZone: z.string().min(1).max(64).optional(),
});

function validZone(zone: string | undefined): string {
  if (!zone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

/** Keys are managed only from a signed-in browser session, never with a key. */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ keys: await getApiKeys(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createKeySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Give the key a name." }, { status: 400 });
  }

  const created = await createApiKey(
    session.user.id,
    parsed.data.name,
    validZone(parsed.data.timeZone),
  );

  return NextResponse.json(created, { status: 201 });
}
