"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RoutineEditor } from "@/components/routine-editor";
import { SortableList, SortableRow } from "@/components/sortable-list";
import { SearchField, StarButton } from "@/components/task-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMinutes } from "@/lib/dates";
import { searchMatches } from "@/lib/task-views";
import { priorityLabels, type RoutineItem, type StepItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RoutinesView({
  initialRoutines,
  date,
}: {
  initialRoutines: RoutineItem[];
  date: string;
}) {
  const [routines, setRoutines] = useState(initialRoutines);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");

  const editing = routines.find((item) => item.id === editingId) ?? null;
  const visible = useMemo(
    () => routines.filter((item) => searchMatches(item, query)),
    [routines, query],
  );
  const filtering = query.trim().length > 0;

  function openNew() {
    setEditingId(null);
    setSheetOpen(true);
  }

  function openEdit(routine: RoutineItem) {
    setEditingId(routine.id);
    setSheetOpen(true);
  }

  function patch(routine: RoutineItem, changes: Partial<RoutineItem>) {
    setRoutines((current) =>
      current.map((item) =>
        item.id === routine.id ? { ...item, ...changes } : item,
      ),
    );

    void fetch(`/api/routines/${routine.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }).then((response) => {
      if (!response.ok) {
        toast.error("Couldn't update that routine.");
        setRoutines((current) =>
          current.map((item) => (item.id === routine.id ? routine : item)),
        );
      }
    });
  }

  function setSteps(routineId: string, steps: StepItem[]) {
    setRoutines((current) =>
      current.map((item) => (item.id === routineId ? { ...item, steps } : item)),
    );
  }

  async function remove(routine: RoutineItem) {
    setRoutines((current) => current.filter((item) => item.id !== routine.id));

    const response = await fetch(`/api/routines/${routine.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Couldn't delete that routine.");
      setRoutines((current) => [...current, routine]);
    }
  }

  function reorder(ids: string[]) {
    const byId = new Map(routines.map((item) => [item.id, item]));
    setRoutines(ids.map((id) => byId.get(id)!).filter(Boolean));

    void fetch("/api/routines/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then((response) => {
      if (!response.ok) toast.error("Couldn't save the new order.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={openNew} className="sm:order-2">
          New routine
        </Button>
        {routines.length > 0 && (
          <div className="flex-1 sm:order-1">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search routines"
            />
          </div>
        )}
      </div>

      {routines.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-10 text-center">
          No routines yet. Add the things you repeat daily or weekly.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          No routines match “{query.trim()}”.
        </p>
      ) : (
        <SortableList
          ids={visible.map((item) => item.id)}
          onReorder={reorder}
          disabled={filtering}
        >
          {visible.map((routine) => (
            <SortableRow
              key={routine.id}
              id={routine.id}
              disabled={filtering}
              className="py-3"
            >
              <Checkbox
                checked={routine.active}
                onCheckedChange={() =>
                  patch(routine, { active: !routine.active })
                }
                aria-label={`${routine.active ? "Pause" : "Resume"} ${routine.title}`}
              />
              <button
                type="button"
                onClick={() => openEdit(routine)}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={cn(
                    "block truncate",
                    !routine.active && "text-muted-foreground",
                  )}
                >
                  {routine.title}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {[
                    routine.recurrence,
                    routine.timeOfDay,
                    routine.estimatedMinutes
                      ? formatMinutes(routine.estimatedMinutes)
                      : null,
                    routine.priority === "none"
                      ? null
                      : `${priorityLabels[routine.priority]} priority`,
                    routine.steps.length
                      ? `${routine.steps.length} step${routine.steps.length === 1 ? "" : "s"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
              <StarButton
                active={routine.important}
                onToggle={() =>
                  patch(routine, { important: !routine.important })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${routine.title}`}
                className="transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"
                onClick={() => openEdit(routine)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${routine.title}`}
                className="transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"
                onClick={() => remove(routine)}
              >
                <Trash2 />
              </Button>
            </SortableRow>
          ))}
        </SortableList>
      )}

      <RoutineEditor
        open={sheetOpen}
        routine={editing}
        date={date}
        onClose={() => setSheetOpen(false)}
        onStepsChange={setSteps}
        onSaved={(item, created) => {
          setRoutines((current) =>
            created
              ? [...current, item]
              : current.map((entry) => (entry.id === item.id ? item : entry)),
          );
          if (created) {
            setEditingId(item.id);
          } else {
            setSheetOpen(false);
          }
        }}
      />
    </div>
  );
}
