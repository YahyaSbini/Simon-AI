"use client";

import { CalendarClock, Clock, Sun, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDue, formatMinutes, today } from "@/lib/dates";
import type { ListItem, TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskView({
  initialTasks,
  lists,
  listId = null,
  emptyMessage,
}: {
  initialTasks: TaskItem[];
  lists: ListItem[];
  listId?: string | null;
  emptyMessage: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openTask = tasks.find((item) => item.id === openTaskId) ?? null;
  const active = tasks.filter((item) => !item.completed);
  const done = tasks.filter((item) => item.completed);

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed) return;

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed, listId }),
    });

    if (!response.ok) {
      toast.error("Couldn't save that task. Try again.");
      return;
    }

    const { task } = await response.json();
    setTasks((current) => [
      {
        id: task.id,
        title: task.title,
        notes: null,
        listId: task.listId,
        priority: task.priority,
        estimatedMinutes: null,
        dueAt: null,
        myDayDate: null,
        completed: false,
        steps: [],
      },
      ...current,
    ]);
    setTitle("");
  }

  function patchTask(item: TaskItem, changes: Partial<TaskItem>, body: object) {
    setTasks((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, ...changes } : entry,
      ),
    );

    startTransition(async () => {
      const response = await fetch(`/api/tasks/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        toast.error("Couldn't update that task.");
        setTasks((current) =>
          current.map((entry) => (entry.id === item.id ? item : entry)),
        );
      }
    });
  }

  function deleteTask(item: TaskItem) {
    setTasks((current) => current.filter((entry) => entry.id !== item.id));
    setOpenTaskId(null);

    startTransition(async () => {
      const response = await fetch(`/api/tasks/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Couldn't delete that task.");
        setTasks((current) => [item, ...current]);
      }
    });
  }

  return (
    <div className="space-y-6">
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

      {tasks.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-10 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-6">
          <TaskRows
            tasks={active}
            onOpen={setOpenTaskId}
            onToggle={(item) =>
              patchTask(item, { completed: true }, { completed: true })
            }
            onDelete={deleteTask}
          />

          {done.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
                Completed · {done.length}
              </h2>
              <TaskRows
                tasks={done}
                onOpen={setOpenTaskId}
                onToggle={(item) =>
                  patchTask(item, { completed: false }, { completed: false })
                }
                onDelete={deleteTask}
              />
            </section>
          )}
        </div>
      )}

      <TaskDetail
        task={openTask}
        lists={lists}
        onClose={() => setOpenTaskId(null)}
        onChange={patchTask}
        onDelete={deleteTask}
        onStepsChange={(taskId, steps) =>
          setTasks((current) =>
            current.map((entry) =>
              entry.id === taskId ? { ...entry, steps } : entry,
            ),
          )
        }
      />
    </div>
  );
}

function TaskRows({
  tasks,
  onOpen,
  onToggle,
  onDelete,
}: {
  tasks: TaskItem[];
  onOpen: (id: string) => void;
  onToggle: (item: TaskItem) => void;
  onDelete: (item: TaskItem) => void;
}) {
  return (
    <ul className="divide-border divide-y">
      {tasks.map((item) => (
        <li key={item.id} className="group flex items-center gap-3 py-2.5">
          <Checkbox
            checked={item.completed}
            onCheckedChange={() => onToggle(item)}
            aria-label={`Mark "${item.title}" complete`}
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

          <PriorityDot priority={item.priority} />

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete "${item.title}"`}
            className="transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            onClick={() => onDelete(item)}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
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
      <span key="estimate" className="inline-flex items-center gap-1">
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

  if (parts.length === 0) return null;

  return (
    <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {parts}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: TaskItem["priority"] }) {
  if (priority === "none") return null;

  return (
    <span
      aria-label={`${priority} priority`}
      title={`${priority} priority`}
      className={cn(
        "size-2 shrink-0 rounded-full",
        priority === "high" && "bg-azure",
        priority === "medium" && "bg-wood",
        priority === "low" && "bg-muted-foreground/40",
      )}
    />
  );
}
