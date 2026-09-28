"use client";

import { CalendarDays, ListTodo, Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { RoutineEditor } from "@/components/routine-editor";
import { SortableList, SortableRow } from "@/components/sortable-list";
import { RowTrail } from "@/components/task-bits";
import { TaskDetail } from "@/components/task-detail";
import { useTasks, useTaskStore } from "@/components/task-store";
import { TaskRows } from "@/components/task-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/dates";
import { playCompleteSound } from "@/lib/sound";
import { taskMatches } from "@/lib/task-views";
import type {
  CalendarAgenda,
  CalendarEvent,
  ListItem,
  RoutineOccurrence,
  StepItem,
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
  const [openRoutineId, setOpenRoutineId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const [tickedTasks, setTickedTasks] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Map<string, Promise<void>>());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  const openTask = store.tasks[openTaskId ?? ""] ?? null;
  const openRoutine =
    routines.find((item) => item.id === openRoutineId) ?? null;
  const openRoutines = routines.filter((item) => !item.completed);
  const visibleRoutines = routines.filter(
    (item) => !item.completed || leaving.has(item.id),
  );

  const openCount = tasks.length + openRoutines.length;
  const doneToday = routines.length - openRoutines.length;

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

  function deleteTask(item: TaskItem) {
    setOpenTaskId(null);
    store.deleteTask(item);
  }

  function patchRoutine(
    item: RoutineOccurrence,
    changes: Partial<RoutineOccurrence>,
  ) {
    setRoutines((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, ...changes } : entry,
      ),
    );

    void fetch(`/api/routines/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }).then((response) => {
      if (!response.ok) {
        toast.error("Couldn't update that routine.");
        setRoutines((current) =>
          current.map((entry) => (entry.id === item.id ? item : entry)),
        );
      }
    });
  }

  function setRoutineSteps(routineId: string, steps: StepItem[]) {
    setRoutines((current) =>
      current.map((entry) =>
        entry.id === routineId ? { ...entry, steps } : entry,
      ),
    );
  }

  function reorderRoutines(ids: string[]) {
    const byId = new Map(routines.map((item) => [item.id, item]));
    const ordered = ids.map((id) => byId.get(id)!).filter(Boolean);
    const moved = new Set(ids);
    setRoutines((current) =>
      current.filter((item) => !moved.has(item.id)).concat(ordered),
    );

    void fetch("/api/routines/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then((response) => {
      if (!response.ok) toast.error("Couldn't save the new order.");
    });
  }

  function toggleRoutine(item: RoutineOccurrence) {
    const completed = !item.completed;
    if (completed) playCompleteSound();

    setRoutines((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, completed } : entry,
      ),
    );

    const timer = timers.current.get(item.id);
    if (timer) clearTimeout(timer);
    if (completed) {
      setLeaving((current) => new Set(current).add(item.id));
      timers.current.set(
        item.id,
        setTimeout(() => {
          timers.current.delete(item.id);
          setLeaving((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        }, 600),
      );
    } else {
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }

    const previous = inflight.current.get(item.id) ?? Promise.resolve();
    const request = previous.then(async () => {
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
    inflight.current.set(item.id, request);
    startTransition(async () => {
      await request;
      if (inflight.current.get(item.id) === request) {
        inflight.current.delete(item.id);
      }
    });
  }

  const empty =
    tasks.length === 0 && routines.length === 0 && tickedTasks === 0;
  const allDone = !empty && openCount === 0 && visibleRoutines.length === 0;

  return (
    <div className="flex flex-col gap-10 pb-24">
      {agenda.connected && <Agenda agenda={agenda} />}

      <div className="space-y-10">
        {empty ? (
          <div className="border-border space-y-3 rounded-lg border border-dashed px-4 py-12 text-center">
            <p className="text-muted-foreground">
              Nothing planned for today yet. Add a task below or pull one in.
            </p>
            <Button variant="outline" render={<Link href="/tasks" />}>
              Pick from Tasks
            </Button>
          </div>
        ) : allDone ? (
          <div className="border-border space-y-1 rounded-lg border border-dashed px-4 py-12 text-center">
            <p className="font-heading text-xl">
              That&apos;s everything for today.
            </p>
            <p className="text-muted-foreground text-sm">
              <Link
                href="/completed"
                className="underline-offset-4 hover:underline"
              >
                {doneToday === 1
                  ? "1 routine ticked"
                  : `${doneToday} routines ticked`}
              </Link>
            </p>
          </div>
        ) : null}

        {tasks.length > 0 && (
          <section className="space-y-1">
            <SectionHeader
              icon={ListTodo}
              label="Tasks"
              detail={`${tasks.length} left${
                tasks.reduce(sumEstimate, 0)
                  ? ` · about ${formatMinutes(tasks.reduce(sumEstimate, 0))}`
                  : ""
              }`}
            />
            <TaskRows
              tasks={tasks}
              sortable
              onReorder={store.reorderTasks}
              onOpen={setOpenTaskId}
              onToggle={(item) => {
                setTickedTasks((count) => count + 1);
                store.patchTask(item, { completed: true }, { completed: true });
              }}
              onStar={(item) =>
                store.patchTask(
                  item,
                  { important: !item.important },
                  { important: !item.important },
                )
              }
              onDelete={deleteTask}
            />
          </section>
        )}

        {visibleRoutines.length > 0 && (
          <section className="space-y-1">
            <SectionHeader
              icon={Repeat}
              label="Routines"
              detail={
                doneToday
                  ? `${openRoutines.length} left · ${doneToday} ticked`
                  : `${openRoutines.length} left`
              }
            />

            <SortableList
              ids={visibleRoutines.map((item) => item.id)}
              onReorder={reorderRoutines}
            >
              {visibleRoutines.map((item) => (
                <SortableRow
                  key={item.id}
                  id={item.id}
                  className={cn(
                    "py-2.5 transition-opacity duration-500",
                    item.completed && "opacity-40",
                  )}
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => toggleRoutine(item)}
                    aria-label={`Mark routine "${item.title}" done today`}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenRoutineId(item.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span
                      className={cn(
                        "block truncate",
                        item.completed && "text-muted-foreground line-through",
                      )}
                    >
                      {item.title}
                    </span>
                    {(item.notes ||
                      item.steps.length > 0 ||
                      item.timeOfDay ||
                      item.estimatedMinutes) && (
                      <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                        {routineTime(item) && (
                          <span className="sm:hidden">{routineTime(item)}</span>
                        )}
                        {item.steps.length > 0 && (
                          <span>
                            {`${item.steps.filter((step) => step.completed).length} of ${item.steps.length} steps`}
                          </span>
                        )}
                        {item.notes && (
                          <span className="truncate">{item.notes}</span>
                        )}
                      </span>
                    )}
                  </button>
                  <RowTrail
                    time={routineTime(item)}
                    priority={item.priority}
                    important={item.important}
                    onStar={() =>
                      patchRoutine(item, { important: !item.important })
                    }
                  />
                  <span className="size-8 shrink-0" aria-hidden />
                </SortableRow>
              ))}
            </SortableList>
          </section>
        )}
      </div>

      <form
        onSubmit={addTask}
        className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur md:left-64"
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3 md:px-8">
          <div className="relative flex-1">
            <Plus
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a task for today"
              aria-label="Task title"
              maxLength={200}
              className="h-10 pl-9"
            />
          </div>
          <Button
            type="submit"
            className="h-10"
            disabled={pending || title.trim().length === 0}
          >
            Add
          </Button>
        </div>
      </form>

      <RoutineEditor
        open={openRoutine !== null}
        routine={openRoutine}
        date={date}
        onClose={() => setOpenRoutineId(null)}
        onStepsChange={setRoutineSteps}
        onSaved={(item) => {
          setRoutines((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, ...item } : entry,
            ),
          );
          setOpenRoutineId(null);
        }}
      />

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

function SectionHeader({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail?: string;
}) {
  return (
    <h2 className="text-muted-foreground border-border mb-2 flex items-center gap-1.5 border-b pb-2 text-xs tracking-wide uppercase">
      <Icon className="size-3.5" />
      {label}
      {detail && (
        <span className="ml-auto font-normal normal-case tracking-normal">
          {detail}
        </span>
      )}
    </h2>
  );
}

function Agenda({ agenda }: { agenda: CalendarAgenda }) {
  return (
    <section className="space-y-1">
      <SectionHeader
        icon={CalendarDays}
        label="Schedule"
        detail={
          agenda.events.length
            ? `${agenda.events.length} ${agenda.events.length === 1 ? "event" : "events"}`
            : undefined
        }
      />
      {agenda.events.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {agenda.failed
            ? "Couldn't reach Google Calendar."
            : "No meetings today."}
        </p>
      )}
      <ul>
        {agenda.events.map((event) => (
          <li
            key={event.id}
            className="hover:bg-muted/50 -mx-2 flex items-baseline gap-3 rounded-md px-2 py-2 transition-colors duration-150"
          >
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

function routineTime(item: RoutineOccurrence): string | null {
  const parts = [
    item.timeOfDay,
    item.estimatedMinutes ? formatMinutes(item.estimatedMinutes) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function sumEstimate(
  total: number,
  item: { estimatedMinutes: number | null },
): number {
  return total + (item.estimatedMinutes ?? 0);
}
