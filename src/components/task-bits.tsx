"use client";

import { Star } from "lucide-react";
import type { TaskItem } from "@/lib/types";
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
