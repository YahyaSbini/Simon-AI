import { toDateKey } from "@/lib/dates";
import type { TaskItem } from "@/lib/types";

export type TaskViewKey = "all" | "important" | "planned" | "list" | "my-day";

/** Client-side mirror of the server queries in `data.ts`, so live edits stay in the right views. */
export function taskMatches(
  view: TaskViewKey,
  task: TaskItem,
  options: { listId?: string | null; date?: string } = {},
): boolean {
  switch (view) {
    case "all":
      return true;
    case "important":
      return task.priority === "high" || task.priority === "medium";
    case "planned":
      return task.dueAt !== null;
    case "list":
      return task.listId === (options.listId ?? null);
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
