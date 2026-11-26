import { NextResponse } from "next/server";
import { deleteApiKey } from "@/lib/api-keys";
import { getSession } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!(await deleteApiKey(session.user.id, id))) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
