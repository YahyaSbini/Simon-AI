import { toDateKey, today } from "@/lib/dates";
import type { TaskItem } from "@/lib/types";

export type TaskViewKey =
  "all" | "important" | "planned" | "list" | "my-day" | "completed";

/** Client-side mirror of the server queries in `data.ts`, so live edits stay in the right views. */
export function taskMatches(
  view: TaskViewKey,
  task: TaskItem,
  options: { listId?: string | null; date?: string } = {},
): boolean {
  switch (view) {
    case "completed":
      return task.completed;
    case "all":
      return !task.completed;
    case "important":
      return !task.completed && task.important;
    case "planned":
      return !task.completed && task.dueAt !== null;
    case "list":
      return !task.completed && task.listId === (options.listId ?? null);
    case "my-day": {
      const date = options.date ?? "";
      return (
        !task.completed &&
        (task.myDayDate === date ||
          (task.dueAt !== null && toDateKey(new Date(task.dueAt)) <= date))
      );
    }
  }
}

export function isOverdue(task: TaskItem, now = new Date()): boolean {
  return !task.completed && task.dueAt !== null && new Date(task.dueAt) < now;
}

/** Case-insensitive match against title, notes and step titles. */
export function searchMatches(
  item: { title: string; notes?: string | null; steps?: { title: string }[] },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    item.title,
    item.notes ?? "",
    ...(item.steps ?? []).map((s) => s.title),
  ]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

/** Tasks view default: due today first, then other dated tasks (overdue, then upcoming), then the rest in saved order. */
export function dueDateFirst(tasks: TaskItem[], date = today()): TaskItem[] {
  const rank = (task: TaskItem) =>
    task.dueAt === null ? 2 : toDateKey(new Date(task.dueAt)) === date ? 0 : 1;
  return [...tasks].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff || a.dueAt === null || b.dueAt === null) return diff;
    return a.dueAt.localeCompare(b.dueAt);
  });
}
