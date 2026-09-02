"use client";

import { CalendarDays, Repeat } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { TaskDetail } from "@/components/task-detail";
import { useTasks, useTaskStore } from "@/components/task-store";
import { PriorityDot, TaskMeta } from "@/components/task-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/dates";
import { taskMatches } from "@/lib/task-views";
import type {
  CalendarAgenda,
  CalendarEvent,
  ListItem,
  RoutineOccurrence,
  TaskItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function MyDayView({
  date,
  initialTasks,
  initialRoutines,
  lists,
  agenda,
}: {
  date: string;
  initialTasks: TaskItem[];
  initialRoutines: RoutineOccurrence[];
  lists: ListItem[];
  agenda: CalendarAgenda;
}) {
  const store = useTaskStore();
  const matches = useCallback(
    (task: TaskItem) => taskMatches("my-day", task, { date }),
    [date],
  );
  const tasks = useTasks(initialTasks, matches);
  const [routines, setRoutines] = useState(initialRoutines);
  const [title, setTitle] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openTask = store.tasks[openTaskId ?? ""] ?? null;

  const remaining =
    tasks.reduce(sumEstimate, 0) +
    routines.filter((item) => !item.completed).reduce(sumEstimate, 0);

  const openCount =
    tasks.length + routines.filter((item) => !item.completed).length;

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed) return;

    startTransition(async () => {
      const created = await store.createTask({
        title: trimmed,
        myDayDate: date,
      });
      if (created) setTitle("");
    });
  }

  function completeTask(item: TaskItem) {
    store.patchTask(item, { completed: true }, { completed: true });
  }

  function deleteTask(item: TaskItem) {
    setOpenTaskId(null);
    store.deleteTask(item);
  }

  function toggleRoutine(item: RoutineOccurrence) {
    const completed = !item.completed;

    setRoutines((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, completed } : entry,
      ),
    );

    startTransition(async () => {
      const response = await fetch(
        completed
          ? `/api/routines/${item.id}/completion`
          : `/api/routines/${item.id}/completion?date=${date}`,
        {
          method: completed ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          ...(completed ? { body: JSON.stringify({ date }) } : {}),
        },
      );

      if (!response.ok) {
        toast.error("Couldn't update that routine.");
        setRoutines((current) =>
          current.map((entry) => (entry.id === item.id ? item : entry)),
        );
      }
    });
  }

  const empty = tasks.length === 0 && routines.length === 0;

  return (
    <div className="space-y-6">
      <form onSubmit={addTask} className="flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task for today"
          aria-label="Task title"
          maxLength={200}
        />
        <Button type="submit" disabled={pending || title.trim().length === 0}>
          Add
        </Button>
      </form>

      {agenda.connected && <Agenda agenda={agenda} />}

      {empty ? (
        <div className="border-border space-y-3 rounded-lg border border-dashed px-4 py-10 text-center">
          <p className="text-muted-foreground">
            Nothing planned for today yet.
          </p>
          <Button variant="outline" render={<Link href="/tasks" />}>
            Pick from Tasks
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {openCount === 0
            ? "Everything on today's plan is done."
            : `${openCount} left${remaining ? ` · about ${formatMinutes(remaining)}` : ""}`}
        </p>
      )}

      <ul className="divide-border divide-y">
        {routines.map((item) => (
          <li
            key={`routine-${item.id}`}
            className="flex items-center gap-3 py-2.5"
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={() => toggleRoutine(item)}
              aria-label={`Mark routine "${item.title}" done today`}
            />
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate",
                  item.completed && "text-muted-foreground line-through",
                )}
              >
                {item.title}
              </span>
              <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <Repeat className="size-3" />
                  Routine
                </span>
                {item.timeOfDay && <span>{item.timeOfDay}</span>}
                {item.estimatedMinutes && (
                  <span>{formatMinutes(item.estimatedMinutes)}</span>
                )}
              </span>
            </div>
            <PriorityDot priority={item.priority} />
          </li>
        ))}

        {tasks.map((item) => (
          <li
            key={`task-${item.id}`}
            className="flex items-center gap-3 py-2.5"
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={() => completeTask(item)}
              aria-label={`Mark "${item.title}" complete`}
            />
            <button
              type="button"
              onClick={() => setOpenTaskId(item.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate">{item.title}</span>
              <TaskMeta task={item} />
            </button>
            <PriorityDot priority={item.priority} />
          </li>
        ))}
      </ul>

      <TaskDetail
        task={openTask}
        lists={lists}
        onClose={() => setOpenTaskId(null)}
        onChange={store.patchTask}
        onDelete={deleteTask}
        onStepsChange={store.setSteps}
      />
    </div>
  );
}

function Agenda({ agenda }: { agenda: CalendarAgenda }) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wide uppercase">
        <CalendarDays className="size-3.5" />
        Schedule
      </h2>
      {agenda.events.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {agenda.failed
            ? "Couldn't reach Google Calendar."
            : "No meetings today."}
        </p>
      )}
      <ul className="divide-border divide-y">
        {agenda.events.map((event) => (
          <li key={event.id} className="flex items-baseline gap-3 py-2">
            <span className="text-muted-foreground w-16 shrink-0 text-xs tabular-nums">
              {formatEventTime(event)}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate">{event.title}</span>
              {event.location && (
                <span className="text-muted-foreground block truncate text-xs">
                  {event.location}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay || !event.start) return "All day";

  return new Date(event.start).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function sumEstimate(
  total: number,
  item: { estimatedMinutes: number | null },
): number {
  return total + (item.estimatedMinutes ?? 0);
}
