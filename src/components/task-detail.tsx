"use client";

import { Sun, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  const [step, setStep] = useState("");
  const [due, setDue] = useState("");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setStep("");
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

  async function addStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;
    const trimmed = step.trim();

    if (!trimmed) return;

    const response = await fetch(`/api/tasks/${task.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!response.ok) {
      toast.error("Couldn't add that step.");
      return;
    }

    const { step: created } = await response.json();
    onStepsChange(task.id, [
      ...task.steps,
      { id: created.id, title: created.title, completed: false },
    ]);
    setStep("");
  }

  async function toggleStep(item: StepItem) {
    if (!task) return;
    const completed = !item.completed;

    onStepsChange(
      task.id,
      task.steps.map((entry) =>
        entry.id === item.id ? { ...entry, completed } : entry,
      ),
    );

    const response = await fetch(`/api/steps/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (!response.ok) {
      toast.error("Couldn't update that step.");
      onStepsChange(task.id, task.steps);
    }
  }

  async function renameStep(item: StepItem, title: string) {
    if (!task) return;
    const trimmed = title.trim();

    if (!trimmed || trimmed === item.title) return;

    onStepsChange(
      task.id,
      task.steps.map((entry) =>
        entry.id === item.id ? { ...entry, title: trimmed } : entry,
      ),
    );

    const response = await fetch(`/api/steps/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!response.ok) {
      toast.error("Couldn't rename that step.");
      onStepsChange(task.id, task.steps);
    }
  }

  async function deleteStep(item: StepItem) {
    if (!task) return;

    onStepsChange(
      task.id,
      task.steps.filter((entry) => entry.id !== item.id),
    );

    const response = await fetch(`/api/steps/${item.id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Couldn't remove that step.");
      onStepsChange(task.id, task.steps);
    }
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

          <section className="space-y-2">
            <Label htmlFor="task-step">Steps</Label>
            {task.steps.length > 0 && (
              <ul className="space-y-1">
                {task.steps.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleStep(item)}
                      aria-label={`Mark step "${item.title}" complete`}
                    />
                    <StepTitle
                      step={item}
                      onRename={(title) => renameStep(item, title)}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove step "${item.title}"`}
                      className="transition-opacity md:opacity-0 md:group-hover:opacity-100"
                      onClick={() => deleteStep(item)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addStep} className="flex gap-2">
              <Input
                id="task-step"
                value={step}
                onChange={(event) => setStep(event.target.value)}
                placeholder="Add a step"
                maxLength={200}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={step.trim().length === 0}
              >
                Add
              </Button>
            </form>
          </section>

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

function StepTitle({
  step,
  onRename,
}: {
  step: StepItem;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(step.title);

  function commit() {
    setEditing(false);
    onRename(value);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            event.stopPropagation();
            setValue(step.title);
            setEditing(false);
          }
        }}
        aria-label="Step title"
        maxLength={200}
        className="h-7 flex-1 px-1 text-sm"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(step.title);
        setEditing(true);
      }}
      className={cn(
        "hover:bg-muted/60 flex-1 rounded px-1 py-0.5 text-left text-sm transition-colors",
        step.completed && "text-muted-foreground line-through",
      )}
      aria-label={`Edit step "${step.title}"`}
    >
      {step.title}
    </button>
  );
}
