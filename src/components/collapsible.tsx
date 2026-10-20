"use client";

import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Ids of closed sections, remembered on this device. Everything starts open. */
export function useClosedSections(storageKey: string) {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setClosed(new Set(saved.map(String)));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const setOpen = useCallback(
    (ids: string[], open: boolean) => {
      setClosed((current) => {
        const next = new Set(current);
        for (const id of ids) {
          if (open) next.delete(id);
          else next.add(id);
        }
        localStorage.setItem(storageKey, JSON.stringify([...next]));
        return next;
      });
    },
    [storageKey],
  );

  return { closed, setOpen };
}

export function CollapseToggle({
  open,
  controls,
  count,
  onToggle,
  className,
  children,
}: {
  open: boolean;
  controls: string;
  count?: number;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        "focus-visible:ring-ring -ml-1 flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 text-left outline-none focus-visible:ring-2",
        className,
      )}
    >
      <ChevronRight
        className={cn(
          "text-muted-foreground size-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
          open && "rotate-90",
        )}
        aria-hidden
      />
      {children}
      {!open && count !== undefined && (
        <span className="text-muted-foreground shrink-0 font-sans text-sm tracking-normal normal-case tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

export function CollapseBody({
  id,
  open,
  className,
  children,
}: {
  id: string;
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className={cn("min-h-0 overflow-hidden", className)}>{children}</div>
    </div>
  );
}

/** "Collapse all" while anything is open, otherwise "Expand all". */
export function CollapseAllButton({
  anyOpen,
  onClick,
}: {
  anyOpen: boolean;
  onClick: (open: boolean) => void;
}) {
  return (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => onClick(!anyOpen)}
      >
        {anyOpen ? "Collapse all" : "Expand all"}
      </Button>
    </div>
  );
}
