"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playCompleteSound } from "@/lib/sound";
import type { StepItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Add / tick / rename / remove steps against a REST pair:
 * `POST createUrl` and `PATCH|DELETE stepUrl(id)`. `tickBody` is merged into
 * completion requests (routines pass the occurrence date).
 */
export function StepEditor({
  steps,
  onChange,
  createUrl,
  stepUrl,
  tickBody = {},
  inputId = "step-title",
}: {
  steps: StepItem[];
  onChange: (steps: StepItem[]) => void;
  createUrl: string;
  stepUrl: (id: string) => string;
  tickBody?: object;
  inputId?: string;
}) {
  const [draft, setDraft] = useState("");

  async function addStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const response = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!response.ok) {
      toast.error("Couldn't add that step.");
      return;
    }

    const { step: created } = await response.json();
    onChange([...steps, { id: created.id, title: created.title, completed: false }]);
    setDraft("");
  }

  async function toggleStep(item: StepItem) {
    const completed = !item.completed;
    if (completed) playCompleteSound();

    onChange(
      steps.map((entry) =>
        entry.id === item.id ? { ...entry, completed } : entry,
      ),
    );

    const response = await fetch(stepUrl(item.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed, ...tickBody }),
    });

    if (!response.ok) {
      toast.error("Couldn't update that step.");
      onChange(steps);
    }
  }

  async function renameStep(item: StepItem, title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) return;

    onChange(
      steps.map((entry) =>
        entry.id === item.id ? { ...entry, title: trimmed } : entry,
      ),
    );

    const response = await fetch(stepUrl(item.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (!response.ok) {
      toast.error("Couldn't rename that step.");
      onChange(steps);
    }
  }

  async function deleteStep(item: StepItem) {
    onChange(steps.filter((entry) => entry.id !== item.id));

    const response = await fetch(stepUrl(item.id), { method: "DELETE" });

    if (!response.ok) {
      toast.error("Couldn't remove that step.");
      onChange(steps);
    }
  }

  return (
    <section className="space-y-2">
      <Label htmlFor={inputId}>Steps</Label>
      {steps.length > 0 && (
        <ul className="space-y-1">
          {steps.map((item) => (
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
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a step"
          maxLength={200}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={draft.trim().length === 0}
        >
          Add
        </Button>
      </form>
    </section>
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
