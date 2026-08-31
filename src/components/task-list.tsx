"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TaskItem = {
  id: string;
  title: string;
  completedAt: string | null;
};

export function TaskList({ initialTasks }: { initialTasks: TaskItem[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed) {
      return;
    }

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!response.ok) {
      toast.error("Couldn't save that task. Try again.");
      return;
    }

    const { task } = await response.json();
    setTasks((current) => [
      { id: task.id, title: task.title, completedAt: null },
      ...current,
    ]);
    setTitle("");
  }

  function toggleTask(item: TaskItem) {
    const completed = item.completedAt === null;

    setTasks((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              completedAt: completed ? new Date().toISOString() : null,
            }
          : entry,
      ),
    );

    startTransition(async () => {
      const response = await fetch(`/api/tasks/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) {
        toast.error("Couldn't update that task.");
        setTasks((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, completedAt: item.completedAt }
              : entry,
          ),
        );
      }
    });
  }

  function deleteTask(item: TaskItem) {
    setTasks((current) => current.filter((entry) => entry.id !== item.id));

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
          Nothing here yet. Add your first task above.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {tasks.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-3 py-3 transition-colors"
            >
              <Checkbox
                checked={item.completedAt !== null}
                onCheckedChange={() => toggleTask(item)}
                aria-label={`Mark "${item.title}" complete`}
              />
              <span
                className={cn(
                  "flex-1 transition-colors",
                  item.completedAt && "text-muted-foreground line-through",
                )}
              >
                {item.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete "${item.title}"`}
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => deleteTask(item)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
