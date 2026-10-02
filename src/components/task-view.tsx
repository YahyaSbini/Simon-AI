"use client";

import { CalendarClock, Clock, Sun, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { SortableList, SortableRow } from "@/components/sortable-list";
import { RowTrail } from "@/components/task-bits";
import { useOpenParam } from "@/components/use-open-param";
import { TaskDetail } from "@/components/task-detail";
import { useTasks, useTaskStore } from "@/components/task-store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDue, formatMinutes, today } from "@/lib/dates";
import {
  dueDateFirst,
  isOverdue,
  taskMatches,
  type TaskViewKey,
} from "@/lib/task-views";
import type { ListItem, TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskView({
  initialTasks,
  lists,
  listId = null,
  view,
  emptyMessage,
  date,
}: {
  initialTasks: TaskItem[];
  lists: ListItem[];
  listId?: string | null;
  view: TaskViewKey;
  emptyMessage: string;
  date?: string;
}) {
  const store = useTaskStore();
  const matches = useCallback(
    (task: TaskItem) => taskMatches(view, task, { listId }),
    [view, listId],
  );
  const unsorted = useTasks(initialTasks, matches);
  const tasks = useMemo(
    () => (view === "all" ? dueDateFirst(unsorted, date) : unsorted),
    [view, unsorted, date],
  );
  const [title, setTitle] = useState("");
  const [openTaskId, setOpenTaskId] = useOpenParam();
  const [pending, startTransition] = useTransition();

  const openTask = store.tasks[openTaskId ?? ""] ?? null;
  const completedView = view === "completed";

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed) return;

    startTransition(async () => {
      const created = await store.createTask({ title: trimmed, listId });
      if (created) setTitle("");
    });
  }

  function deleteTask(item: TaskItem) {
    setOpenTaskId(null);
    store.deleteTask(item);
  }

  return (
    <div className="space-y-6">
      {!completedView && (
        <form onSubmit={addTask} className="flex gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task"
            aria-label="Task title"
            maxLength={200}
          />
          <Button type="submit" disabled={pending || title.trim().length === 0}>
            Add
          </Button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-10 text-center">
          {emptyMessage}
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

export function TaskRows({
  tasks,
  sortable = false,
  onReorder = () => {},
  onOpen,
  onToggle,
  onStar,
  onDelete,
}: {
  tasks: TaskItem[];
  sortable?: boolean;
  onReorder?: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onToggle: (item: TaskItem) => void;
  onStar: (item: TaskItem) => void;
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

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete "${item.title}"`}
            className="size-8 transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"
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
  const parts: React.ReactNode[] = [];

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
