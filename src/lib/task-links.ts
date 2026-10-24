import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { activity, routine, task, type TaskType } from "@/db/schema";

export type LinkFields = {
  type: TaskType;
  parentId: string | null;
  activityId: string | null;
};

export const missingLinkError =
  "Dependent and hybrid items need a task or an activity.";

/**
 * Resolves the link a task or routine ends up with after a create/update and
 * checks it: dependent/hybrid need a parent or an activity, independent has
 * neither, and both must belong to the user. Returns an error message or the
 * links to store.
 */
export async function resolveLinks(
  userId: string,
  kind: "task" | "routine",
  selfId: string | null,
  next: LinkFields,
): Promise<
  | { error: string; status: number }
  | { parentId: string | null; activityId: string | null }
> {
  if (next.type === "independent") return { parentId: null, activityId: null };
  if (!next.parentId && !next.activityId) {
    return { error: missingLinkError, status: 400 };
  }
  if (next.parentId && next.parentId === selfId) {
    return { error: "An item can't be under itself.", status: 400 };
  }

  if (next.parentId) {
    const table = kind === "task" ? task : routine;
    const [owned] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, next.parentId), eq(table.userId, userId)));
    if (!owned) {
      return {
        error: kind === "task" ? "Task not found." : "Routine not found.",
        status: 404,
      };
    }
  }

  if (next.activityId) {
    const [owned] = await db
      .select({ id: activity.id })
      .from(activity)
      .where(
        and(eq(activity.id, next.activityId), eq(activity.userId, userId)),
      );
    if (!owned) return { error: "Activity not found.", status: 404 };
  }

  return { parentId: next.parentId, activityId: next.activityId };
}

export async function getLinkTargets(userId: string) {
  const [activities, tasks, routines] = await Promise.all([
    db
      .select({ id: activity.id, name: activity.name, emoji: activity.emoji })
      .from(activity)
      .where(eq(activity.userId, userId))
      .orderBy(asc(activity.position), asc(activity.createdAt)),
    db
      .select({
        id: task.id,
        title: task.title,
        completed: isNotNull(task.completedAt),
      })
      .from(task)
      .where(eq(task.userId, userId))
      .orderBy(asc(task.title)),
    db
      .select({ id: routine.id, title: routine.title })
      .from(routine)
      .where(eq(routine.userId, userId))
      .orderBy(asc(routine.title)),
  ]);

  return { activities, tasks, routines };
}
