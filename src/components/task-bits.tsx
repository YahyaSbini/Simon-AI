"use client";

import { Star } from "lucide-react";
import type { TaskType } from "@/db/schema";
import { Input } from "@/components/ui/input";
import { taskTypes, type TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StarButton({
  active,
  onToggle,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={active ? "Remove from Important" : "Mark as important"}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm p-1 transition-colors duration-150 outline-none focus-visible:ring-2",
        active && "text-primary hover:text-primary",
        className,
      )}
    >
      <Star
        className="size-4"
        fill={active ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}

export function OverdueDot({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Overdue"
      title="Overdue"
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full bg-red-600",
        className,
      )}
    />
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

/**
 * Trailing columns shared by task and routine rows. Every slot keeps its width
 * even when empty so markers line up across rows and sections.
 */
export function RowTrail({
  time,
  priority,
  overdue = false,
  important,
  onStar,
}: {
  time?: string | null;
  priority: TaskItem["priority"];
  overdue?: boolean;
  important: boolean;
  onStar: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center">
      <span className="text-muted-foreground hidden w-24 truncate text-right text-xs tabular-nums sm:block">
        {time}
      </span>
      <span className="flex w-6 justify-center">
        <PriorityDot priority={priority} />
      </span>
      <span className="flex w-5 justify-center">
        {overdue && <OverdueDot />}
      </span>
      <StarButton active={important} onToggle={onStar} />
    </span>
  );
}

/** Parses a minutes field; null unless it is a whole number from 1 to 1440. */
export function parseMinutes(value: string): number | null {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440
    ? minutes
    : null;
}

export const fieldSelectClass =
  "border-input bg-background h-8 rounded-lg border px-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Required time and type pickers shown next to every "add a task" box. */
export function TaskSetupFields({
  minutes,
  type,
  onMinutesChange,
  onTypeChange,
  className,
}: {
  minutes: string;
  type: TaskType;
  onMinutesChange: (value: string) => void;
  onTypeChange: (value: TaskType) => void;
  className?: string;
}) {
  return (
    <>
      <label className="relative shrink-0">
        <span className="sr-only">Time in minutes</span>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          required
          value={minutes}
          onChange={(event) => onMinutesChange(event.target.value)}
          aria-invalid={parseMinutes(minutes) === null}
          className={cn("w-20 pr-9 tabular-nums", className)}
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
          min
        </span>
      </label>
      <select
        aria-label="Task type"
        required
        value={type}
        onChange={(event) => onTypeChange(event.target.value as TaskType)}
        className={cn(fieldSelectClass, "shrink-0", className)}
      >
        {taskTypes.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
