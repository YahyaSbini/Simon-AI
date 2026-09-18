"use client";

import { Sun, Trash2, X } from "lucide-react";
import { StepEditor } from "@/components/step-editor";
import { StarButton } from "@/components/task-bits";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toDateKey, today } from "@/lib/dates";
import { type ListItem, priorities, type StepItem, type TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

// A native date input fires change on every keystroke, so partial years like 0026 arrive here.
function isCompleteDateKey(value: string) {
  const year = Number(value.slice(0, 4));
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && year >= 1900 && year <= 2999;
}

export const selectClass =
  "border-input h-8 w-full rounded-lg border bg-transparent px-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function TaskDetail({
  task,
  lists,
  onClose,
  onChange,
  onDelete,
  onStepsChange,
}: {
  task: TaskItem | null;
  lists: ListItem[];
  onClose: () => void;
  onChange: (item: TaskItem, changes: Partial<TaskItem>, body: object) => void;
  onDelete: (item: TaskItem) => void;
  onStepsChange: (taskId: string, steps: StepItem[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
  }, [task?.id, task?.title, task?.notes]);

  useEffect(() => {
    setDue(task?.dueAt ? toDateKey(new Date(task.dueAt)) : "");
  }, [task?.id, task?.dueAt]);

  if (!task) return null;

  const inMyDay = task.myDayDate === today();

  function commitTitle() {
    if (!task) return;
    const trimmed = title.trim();

    if (!trimmed || trimmed === task.title) {
      setTitle(task.title);
      return;
    }

    onChange(task, { title: trimmed }, { title: trimmed });
  }

  function commitDue(value: string) {
    if (!task) return;

    if (value && !isCompleteDateKey(value)) {
      setDue(task.dueAt ? toDateKey(new Date(task.dueAt)) : "");
      return;
    }

    const dueAt = value ? new Date(`${value}T12:00:00`).toISOString() : null;

    if (dueAt === task.dueAt) return;

    onChange(task, { dueAt }, { dueAt });
  }

  function commitNotes() {
    if (!task) return;
    const value = notes.trim();

    if (value === (task.notes ?? "")) return;

    onChange(task, { notes: value || null }, { notes: value || null });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <div className="flex items-start gap-2 p-4">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() =>
              onChange(
                task,
                { completed: !task.completed },
                { completed: !task.completed },
              )
            }
            aria-label="Mark complete"
            className="mt-2"
          />
          <SheetTitle className="sr-only">Task details</SheetTitle>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            aria-label="Task title"
            maxLength={200}
            className={cn(
              "font-heading h-auto border-0 px-1 py-1 text-lg shadow-none focus-visible:ring-0",
              task.completed && "text-muted-foreground line-through",
            )}
          />
          <StarButton
            active={task.important}
            onToggle={() =>
              onChange(
                task,
                { important: !task.important },
                { important: !task.important },
              )
            }
            className="mt-1.5"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close details"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <div className="space-y-5 px-4 pb-4">
          <Button
            variant={inMyDay ? "secondary" : "outline"}
            className="w-full justify-start"
            onClick={() =>
              onChange(
                task,
                { myDayDate: inMyDay ? null : today() },
                { myDayDate: inMyDay ? null : today() },
              )
            }
          >
            <Sun />
            {inMyDay ? "Added to My Day" : "Add to My Day"}
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <select
                id="task-priority"
                className={selectClass}
                value={task.priority}
                onChange={(event) => {
                  const priority = event.target
                    .value as TaskItem["priority"];
                  onChange(task, { priority }, { priority });
                }}
              >
                {priorities.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-estimate">Estimate (minutes)</Label>
              <Input
                id="task-estimate"
                type="number"
                min={1}
                max={1440}
                value={task.estimatedMinutes ?? ""}
                onChange={(event) => {
                  const value = event.target.value
                    ? Number(event.target.value)
                    : null;
                  onChange(
                    task,
                    { estimatedMinutes: value },
                    { estimatedMinutes: value },
                  );
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input
                id="task-due"
                type="date"
                value={due}
                onChange={(event) => {
                  setDue(event.target.value);
                  if (isCompleteDateKey(event.target.value)) commitDue(event.target.value);
                }}
                onBlur={(event) => commitDue(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-list">List</Label>
              <select
                id="task-list"
                className={selectClass}
                value={task.listId ?? ""}
                onChange={(event) => {
                  const listId = event.target.value || null;
                  onChange(task, { listId }, { listId });
                }}
              >
                <option value="">No list</option>
                {lists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <StepEditor
            steps={task.steps}
            onChange={(steps) => onStepsChange(task.id, steps)}
            createUrl={`/api/tasks/${task.id}/steps`}
            stepUrl={(id) => `/api/steps/${id}`}
            inputId="task-step"
          />

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={commitNotes}
              rows={4}
              maxLength={2000}
              placeholder="Anything worth remembering"
            />
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => onDelete(task)}
          >
            <Trash2 />
            Delete task
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
