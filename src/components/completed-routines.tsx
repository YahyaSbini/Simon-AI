"use client";

import { Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import type { CompletedRoutine } from "@/lib/data";
import { formatDay } from "@/lib/dates";

/** Ticked routine occurrences; unticking removes the completion for that day. */
export function CompletedRoutines({
  initialItems,
}: {
  initialItems: CompletedRoutine[];
}) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  if (items.length === 0) return null;

  async function untick(item: CompletedRoutine) {
    setItems((current) =>
      current.filter(
        (entry) => !(entry.id === item.id && entry.date === item.date),
      ),
    );

    const response = await fetch(
      `/api/routines/${item.id}/completion?date=${item.date}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      toast.error("Couldn't untick that routine.");
      setItems((current) => [item, ...current]);
    }
  }

  return (
    <section className="space-y-1">
      <div
        role="separator"
        className="text-muted-foreground flex items-center gap-3 pt-2 text-xs tracking-wide uppercase"
      >
        <span className="bg-border h-px flex-1" />
        <span className="inline-flex items-center gap-1.5">
          <Repeat className="size-3" />
          Routines
        </span>
        <span className="bg-border h-px flex-1" />
      </div>

      <ul className="divide-border divide-y">
        {items.map((item) => (
          <li
            key={`${item.id}-${item.date}`}
            className="flex items-center gap-3 py-2.5"
          >
            <Checkbox
              checked
              onCheckedChange={() => untick(item)}
              aria-label={`Mark routine "${item.title}" not done on ${item.date}`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground block truncate line-through">
                {item.title}
              </span>
              <span className="text-muted-foreground block text-xs">
                {formatDay(item.date)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
