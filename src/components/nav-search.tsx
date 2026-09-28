"use client";

import { CheckCheck, ListTodo, Repeat, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { RoutineItem, TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Results = { tasks: TaskItem[]; routines: RoutineItem[] };

const empty: Results = { tasks: [], routines: [] };

function taskHref(task: TaskItem) {
  const base = task.completed
    ? "/completed"
    : task.listId
      ? `/lists/${task.listId}`
      : "/tasks";
  return `${base}?open=${task.id}`;
}

/** Single search box in the navbar; results drop down under it. */
export function NavSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(empty);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      setResults(empty);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setResults(empty);
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (response.ok) setResults(await response.json());
      } catch {
        // aborted by a newer query
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setFocused(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function go(href: string) {
    setQuery("");
    setFocused(false);
    onNavigate?.();
    router.push(href);
  }

  const showPanel = focused && trimmed.length > 0;
  const total = results.tasks.length + results.routines.length;

  return (
    <div ref={rootRef} className="relative px-1">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            event.currentTarget.blur();
          }
        }}
        placeholder="Search"
        aria-label="Search tasks and routines"
        className="h-8 pr-8 pl-8"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
        >
          <X className="size-3.5" />
        </button>
      )}

      {showPanel && (
        <div
          role="listbox"
          aria-label="Search results"
          className="bg-popover text-popover-foreground border-border absolute inset-x-1 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-lg border p-1 shadow-md"
        >
          {loading && total === 0 ? (
            <p className="text-muted-foreground px-2.5 py-2 text-xs">
              Searching…
            </p>
          ) : total === 0 ? (
            <p className="text-muted-foreground px-2.5 py-2 text-xs">
              Nothing matches “{trimmed}”.
            </p>
          ) : (
            <>
              {results.tasks.length > 0 && (
                <Group label="Tasks">
                  {results.tasks.map((item) => (
                    <Result
                      key={item.id}
                      icon={item.completed ? CheckCheck : ListTodo}
                      title={item.title}
                      muted={item.completed}
                      meta={item.notes}
                      onSelect={() => go(taskHref(item))}
                    />
                  ))}
                </Group>
              )}
              {results.routines.length > 0 && (
                <Group label="Routines">
                  {results.routines.map((item) => (
                    <Result
                      key={item.id}
                      icon={Repeat}
                      title={item.title}
                      meta={item.recurrence}
                      onSelect={() => go(`/routines?open=${item.id}`)}
                    />
                  ))}
                </Group>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="text-muted-foreground px-2.5 pb-1 text-[11px] tracking-wide uppercase">
        {label}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function Result({
  icon: Icon,
  title,
  meta,
  muted,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta?: string | null;
  muted?: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={false}
        onClick={onSelect}
        className="hover:bg-muted focus-visible:bg-muted flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm outline-none"
      >
        <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate", muted && "line-through")}>
            {title}
          </span>
          {meta && (
            <span className="text-muted-foreground block truncate text-xs">
              {meta}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
