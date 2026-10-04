import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import type {
  DayBlock,
  Routine,
  RoutineStep,
  Task,
  TaskStep,
} from "@/db/schema";
import {
  dayBlock,
  list,
  routine,
  routineCompletion,
  routineStep,
  routineStepCompletion,
  task,
  taskStep,
} from "@/db/schema";
import { addDays, fromDateKey, toDateKey } from "@/lib/dates";
import { describeRecurrence, occursOn } from "@/lib/routines";
import type {
  DayBlockItem,
  ListItem,
  RoutineItem,
  RoutineOccurrence,
  TaskItem,
} from "@/lib/types";

export type TaskView = "all" | "important" | "planned" | "list" | "completed";

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
    scope.push(eq(task.important, true));
  }
  if (view === "planned") {
    scope.push(isNotNull(task.dueAt));
  }
  scope.push(
    view === "completed"
      ? isNotNull(task.completedAt)
      : isNull(task.completedAt),
  );

  const rows = await db
    .select()
    .from(task)
    .where(and(...scope))
    .orderBy(
      ...(view === "completed"
        ? [desc(task.completedAt)]
        : view === "all"
          ? [
              sql`${task.dueAt} is null`,
              asc(task.dueAt),
              asc(task.position),
              desc(task.createdAt),
            ]
          : [asc(task.position), desc(task.createdAt)]),
    );

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
    important: row.important,
    estimatedMinutes: row.estimatedMinutes,
    dueAt: row.dueAt?.toISOString() ?? null,
    myDayDate: row.myDayDate,
    completed: row.completedAt !== null,
    steps: steps
      .filter((step) => step.taskId === row.id)
      .map((step) => ({
        id: step.id,
        title: step.title,
        notes: step.notes,
        completed: step.completedAt !== null,
      })),
  };
}

export function serializeRoutine(
  row: Routine,
  steps: RoutineStep[] = [],
  completedStepIds: Set<string> = new Set(),
): RoutineItem {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    important: row.important,
    estimatedMinutes: row.estimatedMinutes,
    frequency: row.frequency,
    interval: row.interval,
    byWeekday: row.byWeekday,
    byMonthDay: row.byMonthDay,
    timeOfDay: row.timeOfDay,
    startDate: row.startDate,
    endDate: row.endDate,
    carryOver: row.carryOver,
    active: row.active,
    recurrence: describeRecurrence(row),
    steps: steps
      .filter((step) => step.routineId === row.id)
      .map((step) => ({
        id: step.id,
        title: step.title,
        notes: step.notes,
        completed: completedStepIds.has(step.id),
      })),
  };
}

async function getRoutineSteps(routineIds: string[]): Promise<RoutineStep[]> {
  if (!routineIds.length) return [];
  return db
    .select()
    .from(routineStep)
    .where(inArray(routineStep.routineId, routineIds))
    .orderBy(asc(routineStep.position), asc(routineStep.createdAt));
}

/** All routines with today's step state, where `date` is today in the user's zone. */
export async function getRoutines(
  userId: string,
  date: string,
): Promise<RoutineItem[]> {
  const rows = await db
    .select()
    .from(routine)
    .where(eq(routine.userId, userId))
    .orderBy(
      asc(routine.position),
      asc(routine.timeOfDay),
      asc(routine.createdAt),
    );

  const steps = await getRoutineSteps(rows.map((row) => row.id));
  const doneKeys = await getCompletedStepKeys(steps, date, date);
  const done = new Set(
    steps
      .filter((step) => doneKeys.has(`${step.id}:${date}`))
      .map((step) => step.id),
  );

  return rows.map((row) => serializeRoutine(row, steps, done));
}

/** `${stepId}:${date}` for every ticked step within the inclusive date range. */
async function getCompletedStepKeys(
  steps: RoutineStep[],
  from: string,
  to: string,
): Promise<Set<string>> {
  if (!steps.length) return new Set();
  const rows = await db
    .select({
      stepId: routineStepCompletion.stepId,
      date: routineStepCompletion.date,
    })
    .from(routineStepCompletion)
    .where(
      and(
        inArray(
          routineStepCompletion.stepId,
          steps.map((step) => step.id),
        ),
        gte(routineStepCompletion.date, from),
        lte(routineStepCompletion.date, to),
      ),
    );
  return new Set(rows.map((row) => `${row.stepId}:${row.date}`));
}

/** How far back a carry-over routine keeps missed days. */
const carryOverDays = 30;

/**
 * Routine occurrences for a day, with their completion state. Carry-over
 * routines also contribute their unticked occurrences from the previous
 * `carryOverDays`, oldest first.
 */
export async function getRoutineOccurrences(
  userId: string,
  date: string,
): Promise<RoutineOccurrence[]> {
  const rows = await db
    .select()
    .from(routine)
    .where(eq(routine.userId, userId))
    .orderBy(
      asc(routine.position),
      asc(routine.timeOfDay),
      asc(routine.createdAt),
    );

  const from = toDateKey(addDays(fromDateKey(date), -carryOverDays));
  const candidates: { row: Routine; date: string }[] = [];

  for (const row of rows) {
    if (row.carryOver) {
      for (let offset = carryOverDays; offset >= 1; offset--) {
        const day = toDateKey(addDays(fromDateKey(date), -offset));
        if (occursOn(row, day)) candidates.push({ row, date: day });
      }
    }
    if (occursOn(row, date)) candidates.push({ row, date });
  }

  if (!candidates.length) return [];

  const ids = [...new Set(candidates.map((entry) => entry.row.id))];
  const steps = await getRoutineSteps(ids);
  const doneSteps = await getCompletedStepKeys(steps, from, date);

  const completions = await db
    .select({
      routineId: routineCompletion.routineId,
      date: routineCompletion.date,
    })
    .from(routineCompletion)
    .where(
      and(
        inArray(routineCompletion.routineId, ids),
        gte(routineCompletion.date, from),
        lte(routineCompletion.date, date),
      ),
    );

  const completed = new Set(
    completions.map((row) => `${row.routineId}:${row.date}`),
  );

  return candidates
    .filter(
      (entry) =>
        entry.date === date || !completed.has(`${entry.row.id}:${entry.date}`),
    )
    .map((entry) => {
      const key = `${entry.row.id}:${entry.date}`;
      const done = new Set(
        steps
          .filter((step) => doneSteps.has(`${step.id}:${entry.date}`))
          .map((step) => step.id),
      );
      return {
        ...serializeRoutine(entry.row, steps, done),
        date: entry.date,
        key,
        completed: completed.has(key),
      };
    });
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
    .orderBy(asc(task.position), asc(task.dueAt));

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

export function serializeDayBlock(row: DayBlock): DayBlockItem {
  return {
    id: row.id,
    weekdays: row.weekdays,
    start: row.start,
    end: row.end,
    label: row.label,
    color: row.color,
  };
}

export async function getDayBlocks(userId: string): Promise<DayBlockItem[]> {
  const rows = await db
    .select()
    .from(dayBlock)
    .where(eq(dayBlock.userId, userId))
    .orderBy(asc(dayBlock.start), asc(dayBlock.createdAt));

  return rows.map(serializeDayBlock);
}

export type CompletedRoutine = RoutineItem & {
  /** Occurrence date the routine was ticked on. */
  date: string;
  completedAt: string;
};

/** Every ticked routine occurrence, newest first. */
export async function getCompletedRoutines(
  userId: string,
): Promise<CompletedRoutine[]> {
  const rows = await db
    .select({
      routine,
      date: routineCompletion.date,
      completedAt: routineCompletion.completedAt,
    })
    .from(routineCompletion)
    .innerJoin(routine, eq(routine.id, routineCompletion.routineId))
    .where(eq(routine.userId, userId))
    .orderBy(desc(routineCompletion.date), desc(routineCompletion.completedAt));

  return rows.map((row) => ({
    ...serializeRoutine(row.routine),
    date: row.date,
    completedAt: row.completedAt.toISOString(),
  }));
}
