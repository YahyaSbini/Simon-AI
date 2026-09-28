import { NextResponse } from "next/server";
import { getRoutines, getTasks } from "@/lib/data";
import { today } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { searchMatches } from "@/lib/task-views";

/** Tasks (open and ticked) and routines matching `q`, for the navbar search. */
export async function GET(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ tasks: [], routines: [] });
  }

  const [open, done, routines] = await Promise.all([
    getTasks(userId, "all"),
    getTasks(userId, "completed"),
    getRoutines(userId, today()),
  ]);

  return NextResponse.json({
    tasks: [...open, ...done]
      .filter((item) => searchMatches(item, q))
      .slice(0, 20),
    routines: routines.filter((item) => searchMatches(item, q)).slice(0, 10),
  });
}
