"use client";

import { useEffect, useState } from "react";
import { CompletedRoutines } from "@/components/completed-routines";
import { TaskView } from "@/components/task-view";
import { Button } from "@/components/ui/button";
import type { CompletedRoutine } from "@/lib/data";
import type { CompletedSort } from "@/lib/task-views";
import type { ListItem, TaskItem } from "@/lib/types";

const storageKey = "simon-completed-sort";

const options: { value: CompletedSort; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "title", label: "A–Z" },
];

export function CompletedView({
  tasks,
  lists,
  routines,
}: {
  tasks: TaskItem[];
  lists: ListItem[];
  routines: CompletedRoutine[];
}) {
  const [sort, setSort] = useState<CompletedSort>("date");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "date" || saved === "title") setSort(saved);
  }, []);

  function choose(value: CompletedSort) {
    setSort(value);
    localStorage.setItem(storageKey, value);
  }

  return (
    <div className="space-y-6">
      <div
        role="group"
        aria-label="Sort ticked tasks"
        className="flex items-center gap-1"
      >
        <span className="text-muted-foreground mr-1 text-sm">Sort by</span>
        {options.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={sort === option.value ? "secondary" : "ghost"}
            aria-pressed={sort === option.value}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <TaskView
        initialTasks={tasks}
        lists={lists}
        view="completed"
        completedSort={sort}
        emptyMessage={
          routines.length
            ? "No ticked tasks yet."
            : "Nothing ticked yet. Completed tasks and routines land here."
        }
      />

      <CompletedRoutines initialItems={routines} sort={sort} />
    </div>
  );
}
