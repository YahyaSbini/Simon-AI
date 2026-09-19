"use client";

import { Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export function SearchField({
  value,
  onChange,
  placeholder = "Search tasks",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}
