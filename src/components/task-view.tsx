"use client";

import {
  CalendarClock,
  Clock,
  Hourglass,
  ListTodo,
  Sun,
  Timer,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { SortableList, SortableRow } from "@/components/sortable-list";
import {
  parseMinutes,
  RowTrail,
  TaskSetupFields,
} from "@/components/task-bits";
import { useOpenParam } from "@/components/use-open-param";
import { TaskDetail } from "@/components/task-detail";
import {
  LinkFields,
  LinkMeta,
  needsLink,
  refreshLinkTargets,
} from "@/components/task-links";
import { useTasks, useTaskStore } from "@/components/task-store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDue, formatMinutes, today } from "@/lib/dates";
import {
  type CompletedSort,
  dueDateFirst,
  isOverdue,
  type PlannedFilter,
  plannedMatches,
  sortCompleted,
  taskMatches,
  type TaskViewKey,
} from "@/lib/task-views";
import type { TaskType } from "@/db/schema";
import {
  defaultMinutes,
  type ListItem,
  type TaskItem,
  taskTypeLabels,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskView({
  initialTasks,
  lists,
  listId = null,
  view,
  emptyMessage,
  date,
  completedSort = "date",
}: {
  initialTasks: TaskItem[];
  lists: ListItem[];
  listId?: string | null;
  view: TaskViewKey;
  emptyMessage: string;
  date?: string;
  completedSort?: CompletedSort;
}) {
  const store = useTaskStore();
  const [plannedFilter, setPlannedFilter] = usePlannedFilter(view === "all");
  const matches = useCallback(
    (task: TaskItem) =>
      taskMatches(view, task, { listId }) &&
      (view !== "all" || plannedMatches(task, plannedFilter)),
    [view, listId, plannedFilter],
  );
  const unsorted = useTasks(initialTasks, matches);
  const tasks = useMemo(
    () =>
      view === "all"
        ? dueDateFirst(unsorted, date)
        : view === "completed"
          ? sortCompleted(
              unsorted,
              completedSort,
              (task) => task.completedAt ?? "",
            )
          : unsorted,
    [view, unsorted, date, completedSort],
  );
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const [type, setType] = useState<TaskType>("independent");
  const [countInTime, setCountInTime] = useState(false);
  const [link, setLink] = useState<{
    parentId: string | null;
    activityId: string | null;
  }>({ parentId: null, activityId: null });
  const linkMissing = needsLink(type) && !link.parentId && !link.activityId;
  const [openTaskId, setOpenTaskId] = useOpenParam();
  const [pending, startTransition] = useTransition();

  const openTask = store.tasks[openTaskId ?? ""] ?? null;
  const completedView = view === "completed";

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    const estimatedMinutes = parseMinutes(minutes);

    if (!trimmed || estimatedMinutes === null || linkMissing) return;

    startTransition(async () => {
      const created = await store.createTask({
        title: trimmed,
        estimatedMinutes,
        countInTime,
        type,
        ...(needsLink(type)
          ? { parentTaskId: link.parentId, activityId: link.activityId }
          : {}),
        listId,
        ...(view === "later" ? { later: true } : {}),
      });
      if (created) {
        setTitle("");
        setMinutes(String(defaultMinutes));
        setType("independent");
        setCountInTime(false);
        setLink({ parentId: null, activityId: null });
        void refreshLinkTargets();
      }
    });
  }

  function deleteTask(item: TaskItem) {
    setOpenTaskId(null);
    store.deleteTask(item);
  }

  return (
    <div className="space-y-6">
      {!completedView && (
        <form onSubmit={addTask} className="flex flex-wrap gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task"
            aria-label="Task title"
            maxLength={200}
            className="basis-full sm:flex-1 sm:basis-0"
          />
          <TaskSetupFields
            minutes={minutes}
            type={type}
            onMinutesChange={setMinutes}
            onTypeChange={setType}
            countInTime={countInTime}
            onCountInTimeChange={setCountInTime}
          />
          {needsLink(type) && (
            <LinkFields
              kind="task"
              compact
              parentId={link.parentId}
              activityId={link.activityId}
              onChange={(parentId, activityId) =>
                setLink({ parentId, activityId })
              }
            />
          )}
          <Button
            type="submit"
            className="ml-auto sm:ml-0"
            disabled={
              pending ||
              title.trim().length === 0 ||
              parseMinutes(minutes) === null ||
              linkMissing
            }
          >
            Add
          </Button>
        </form>
      )}

      {view === "all" && (
        <div
          role="group"
          aria-label="Filter tasks"
          className="flex items-center gap-1"
        >
          <span className="text-muted-foreground mr-1 text-sm">Show</span>
          {plannedOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={plannedFilter === option.value ? "secondary" : "ghost"}
              aria-pressed={plannedFilter === option.value}
              onClick={() => setPlannedFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-10 text-center">
          {view === "all" && plannedFilter !== "all"
            ? plannedFilter === "planned"
              ? "No tasks with a due date."
              : "Every task has a due date."
            : emptyMessage}
        </p>
      ) : (
        <TaskRows
          tasks={tasks}
          sortable={!completedView}
          onReorder={store.reorderTasks}
          onOpen={setOpenTaskId}
          onToggle={(item) =>
            store.patchTask(
              item,
              { completed: !item.completed },
              { completed: !item.completed },
            )
          }
          onStar={(item) =>
            store.patchTask(
              item,
              { important: !item.important },
              { important: !item.important },
            )
          }
          onMoveLater={
            completedView
              ? undefined
              : (item) =>
                  store.patchTask(
                    item,
                    { later: !item.later },
                    { later: !item.later },
                  )
          }
          onDelete={deleteTask}
        />
      )}

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

const plannedStorageKey = "simon-tasks-planned-filter";

const plannedOptions: { value: PlannedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "unplanned", label: "Unplanned" },
];

function usePlannedFilter(enabled: boolean) {
  const [filter, setFilter] = useState<PlannedFilter>("all");

  useEffect(() => {
    if (!enabled) return;
    const saved = localStorage.getItem(plannedStorageKey);
    if (saved === "planned" || saved === "unplanned") setFilter(saved);
  }, [enabled]);

  function choose(value: PlannedFilter) {
    setFilter(value);
    localStorage.setItem(plannedStorageKey, value);
  }

  return [filter, choose] as const;
}

const rowActionClass =
  "size-8 transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100";

export function TaskRows({
  tasks,
  sortable = false,
  onReorder = () => {},
  onOpen,
  onToggle,
  onStar,
  onMoveLater,
  onDelete,
}: {
  tasks: TaskItem[];
  sortable?: boolean;
  onReorder?: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onToggle: (item: TaskItem) => void;
  onStar: (item: TaskItem) => void;
  onMoveLater?: (item: TaskItem) => void;
  onDelete: (item: TaskItem) => void;
}) {
  return (
    <SortableList
      ids={tasks.map((item) => item.id)}
      onReorder={onReorder}
      disabled={!sortable}
    >
      {tasks.map((item) => (
        <SortableRow
          key={item.id}
          id={item.id}
          disabled={!sortable}
          className="py-2.5"
        >
          <Checkbox
            checked={item.completed}
            onCheckedChange={() => onToggle(item)}
            aria-label={
              item.completed
                ? `Mark "${item.title}" not complete`
                : `Mark "${item.title}" complete`
            }
          />

          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="min-w-0 flex-1 text-left"
          >
            <span
              className={cn(
                "block truncate transition-colors",
                item.completed && "text-muted-foreground line-through",
              )}
            >
              {item.title}
            </span>
            <TaskMeta task={item} />
          </button>

          <RowTrail
            time={
              item.estimatedMinutes
                ? formatMinutes(item.estimatedMinutes)
                : null
            }
            priority={item.priority}
            overdue={isOverdue(item)}
            important={item.important}
            onStar={() => onStar(item)}
          />

          {onMoveLater && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                item.later
                  ? `Move "${item.title}" to Tasks`
                  : `Move "${item.title}" to Later`
              }
              title={item.later ? "Move to Tasks" : "Move to Later"}
              className={rowActionClass}
              onClick={() => onMoveLater(item)}
            >
              {item.later ? <ListTodo /> : <Hourglass />}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete "${item.title}"`}
            className={rowActionClass}
            onClick={() => onDelete(item)}
          >
            <Trash2 />
          </Button>
        </SortableRow>
      ))}
    </SortableList>
  );
}

export function TaskMeta({ task }: { task: TaskItem }) {
  const steps = task.steps.length;
  const doneSteps = task.steps.filter((step) => step.completed).length;
  const parts: React.ReactNode[] = [
    <span key="type">{taskTypeLabels[task.type]}</span>,
    <LinkMeta
      key="link"
      kind="task"
      type={task.type}
      parentId={task.parentTaskId}
      activityId={task.activityId}
    />,
  ];

  if (task.myDayDate === today()) {
    parts.push(
      <span key="myday" className="inline-flex items-center gap-1">
        <Sun className="size-3" />
        My Day
      </span>,
    );
  }
  if (task.dueAt) {
    parts.push(
      <span key="due" className="inline-flex items-center gap-1">
        <CalendarClock className="size-3" />
        {formatDue(new Date(task.dueAt))}
      </span>,
    );
  }
  if (task.estimatedMinutes) {
    parts.push(
      <span key="estimate" className="inline-flex items-center gap-1 sm:hidden">
        <Clock className="size-3" />
        {formatMinutes(task.estimatedMinutes)}
      </span>,
    );
  }
  if (task.countInTime) {
    parts.push(
      <span key="count" className="inline-flex items-center gap-1">
        <Timer className="size-3" />
        Counts in time
      </span>,
    );
  }
  if (steps > 0) {
    parts.push(
      <span key="steps">
        {doneSteps} of {steps} steps
      </span>,
    );
  }
  if (task.notes) {
    parts.push(
      <span key="notes" className="min-w-0 max-w-full truncate">
        {task.notes}
      </span>,
    );
  }

  if (parts.length === 0) return null;

  return (
    <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {parts}
    </span>
  );
}
