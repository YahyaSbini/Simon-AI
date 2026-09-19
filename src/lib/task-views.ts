import { toDateKey } from "@/lib/dates";
import type { TaskItem } from "@/lib/types";

export type TaskViewKey =
  | "all"
  | "important"
  | "planned"
  | "list"
  | "my-day"
  | "completed";

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
  return [item.title, item.notes ?? "", ...(item.steps ?? []).map((s) => s.title)]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}
