import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import type { Routine, Task, TaskStep } from "@/db/schema";
import {
  list,
  routine,
  routineCompletion,
  task,
  taskStep,
} from "@/db/schema";
import { toDateKey } from "@/lib/dates";
import { describeRecurrence, occursOn } from "@/lib/routines";
import type { ListItem, RoutineItem, RoutineOccurrence, TaskItem } from "@/lib/types";

export type TaskView = "all" | "important" | "planned" | "list";

export async function getLists(userId: string): Promise<ListItem[]> {
  const rows = await db
    .select({ id: list.id, name: list.name })
    .from(list)
    .where(eq(list.userId, userId))
    .orderBy(asc(list.position), asc(list.createdAt));

  return rows;
}

export async function getTasks(
  userId: string,
  view: TaskView,
  options: { listId?: string } = {},
): Promise<TaskItem[]> {
  const scope = [eq(task.userId, userId)];

  if (view === "list" && options.listId) {
    scope.push(eq(task.listId, options.listId));
  }
  if (view === "important") {
    scope.push(inArray(task.priority, ["high", "medium"]));
  }
  if (view === "planned") {
    scope.push(isNotNull(task.dueAt));
  }

  const rows = await db
    .select()
    .from(task)
    .where(and(...scope))
    .orderBy(asc(task.completedAt), asc(task.position), desc(task.createdAt));

  const steps = rows.length
    ? await db
        .select()
        .from(taskStep)
        .where(
          inArray(
            taskStep.taskId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(taskStep.position))
    : [];

  return rows.map((row) => serializeTask(row, steps));
}

export function serializeTask(row: Task, steps: TaskStep[] = []): TaskItem {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    listId: row.listId,
    priority: row.priority,
    estimatedMinutes: row.estimatedMinutes,
    dueAt: row.dueAt?.toISOString() ?? null,
    myDayDate: row.myDayDate,
    completed: row.completedAt !== null,
    steps: steps
      .filter((step) => step.taskId === row.id)
      .map((step) => ({
        id: step.id,
        title: step.title,
        completed: step.completedAt !== null,
      })),
  };
}

export function serializeRoutine(row: Routine): RoutineItem {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    estimatedMinutes: row.estimatedMinutes,
    frequency: row.frequency,
    interval: row.interval,
    byWeekday: row.byWeekday,
    byMonthDay: row.byMonthDay,
    timeOfDay: row.timeOfDay,
    startDate: row.startDate,
    active: row.active,
    recurrence: describeRecurrence(row),
  };
}

export async function getRoutines(userId: string): Promise<RoutineItem[]> {
  const rows = await db
    .select()
    .from(routine)
    .where(eq(routine.userId, userId))
    .orderBy(asc(routine.timeOfDay), asc(routine.createdAt));

  return rows.map(serializeRoutine);
}

/** Routine occurrences for a single day, with their completion state. */
export async function getRoutineOccurrences(
  userId: string,
  date: string,
): Promise<RoutineOccurrence[]> {
  const rows = await db
    .select()
    .from(routine)
    .where(eq(routine.userId, userId))
    .orderBy(asc(routine.timeOfDay), asc(routine.createdAt));

  const due = rows.filter((row) => occursOn(row, date));

  if (!due.length) return [];

  const completions = await db
    .select({ routineId: routineCompletion.routineId })
    .from(routineCompletion)
    .where(
      and(
        inArray(
          routineCompletion.routineId,
          due.map((row) => row.id),
        ),
        eq(routineCompletion.date, date),
      ),
    );

  const completed = new Set(completions.map((row) => row.routineId));

  return due.map((row) => ({
    ...serializeRoutine(row),
    completed: completed.has(row.id),
  }));
}

/** Open tasks that belong on My Day: flagged for today, or due on/before today. */
export async function getMyDayTasks(
  userId: string,
  date: string,
): Promise<TaskItem[]> {
  const rows = await db
    .select()
    .from(task)
    .where(eq(task.userId, userId))
    .orderBy(asc(task.dueAt), asc(task.position));

  const relevant = rows.filter(
    (row) =>
      row.completedAt === null &&
      (row.myDayDate === date || (row.dueAt && toDateKey(row.dueAt) <= date)),
  );

  const steps = relevant.length
    ? await db
        .select()
        .from(taskStep)
        .where(
          inArray(
            taskStep.taskId,
            relevant.map((row) => row.id),
          ),
        )
        .orderBy(asc(taskStep.position))
    : [];

  return relevant.map((row) => serializeTask(row, steps));
}
