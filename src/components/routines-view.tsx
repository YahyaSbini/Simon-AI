"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { selectClass } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatMinutes, today } from "@/lib/dates";
import { describeRecurrence } from "@/lib/routines";
import { priorities, priorityLabels, type RoutineItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const weekdays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

type Draft = {
  title: string;
  frequency: RoutineItem["frequency"];
  interval: number;
  byWeekday: number[];
  byMonthDay: number;
  timeOfDay: string;
  estimatedMinutes: string;
  priority: RoutineItem["priority"];
};

function emptyDraft(): Draft {
  const now = new Date();
  return {
    title: "",
    frequency: "daily",
    interval: 1,
    byWeekday: [((now.getDay() + 6) % 7) + 1],
    byMonthDay: now.getDate(),
    timeOfDay: "",
    estimatedMinutes: "",
    priority: "none",
  };
}

function toDraft(routine: RoutineItem): Draft {
  return {
    title: routine.title,
    frequency: routine.frequency,
    interval: routine.interval,
    byWeekday: routine.byWeekday ?? [],
    byMonthDay: routine.byMonthDay ?? 1,
    timeOfDay: routine.timeOfDay ?? "",
    estimatedMinutes: routine.estimatedMinutes?.toString() ?? "",
    priority: routine.priority,
  };
}

export function RoutinesView({
  initialRoutines,
}: {
  initialRoutines: RoutineItem[];
}) {
  const [routines, setRoutines] = useState(initialRoutines);
  const [editing, setEditing] = useState<RoutineItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setDraft(emptyDraft());
  }

  function openEdit(routine: RoutineItem) {
    setEditing(routine);
    setDraft(toDraft(routine));
  }

  async function save() {
    if (!draft) return;

    const title = draft.title.trim();

    if (!title) {
      toast.error("Give the routine a name.");
      return;
    }

    const body = {
      title,
      frequency: draft.frequency,
      interval: draft.interval,
      byWeekday: draft.frequency === "weekly" ? draft.byWeekday : null,
      byMonthDay: draft.frequency === "monthly" ? draft.byMonthDay : null,
      timeOfDay: draft.timeOfDay || null,
      estimatedMinutes: draft.estimatedMinutes
        ? Number(draft.estimatedMinutes)
        : null,
      priority: draft.priority,
      startDate: editing?.startDate ?? today(),
    };

    setSaving(true);
    const response = await fetch(
      editing ? `/api/routines/${editing.id}` : "/api/routines",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);

    if (!response.ok) {
      toast.error("Couldn't save that routine.");
      return;
    }

    const { routine } = await response.json();
    const item: RoutineItem = {
      ...routine,
      recurrence: describeRecurrence(routine),
    };

    setRoutines((current) =>
      editing
        ? current.map((entry) => (entry.id === item.id ? item : entry))
        : [...current, item],
    );
    setDraft(null);
    setEditing(null);
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

  async function toggleActive(routine: RoutineItem) {
    const active = !routine.active;

    setRoutines((current) =>
      current.map((item) => (item.id === routine.id ? { ...item, active } : item)),
    );

    const response = await fetch(`/api/routines/${routine.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });

    if (!response.ok) {
      toast.error("Couldn't update that routine.");
      setRoutines((current) =>
        current.map((item) => (item.id === routine.id ? routine : item)),
      );
    }
  }

  return (
    <div className="space-y-6">
      <Button onClick={openNew}>New routine</Button>

      {routines.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-10 text-center">
          No routines yet. Add the things you repeat daily or weekly.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {routines.map((routine) => (
            <li key={routine.id} className="group flex items-center gap-3 py-3">
              <Checkbox
                checked={routine.active}
                onCheckedChange={() => toggleActive(routine)}
                aria-label={`${routine.active ? "Pause" : "Resume"} ${routine.title}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate",
                    !routine.active && "text-muted-foreground",
                  )}
                >
                  {routine.title}
                </p>
                <p className="text-muted-foreground text-xs">
                  {[
                    routine.recurrence,
                    routine.timeOfDay,
                    routine.estimatedMinutes
                      ? formatMinutes(routine.estimatedMinutes)
                      : null,
                    routine.priority === "none"
                      ? null
                      : `${priorityLabels[routine.priority]} priority`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${routine.title}`}
                className="transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                onClick={() => openEdit(routine)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${routine.title}`}
                className="transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                onClick={() => remove(routine)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetTitle className="p-4 text-lg">
            {editing ? "Edit routine" : "New routine"}
          </SheetTitle>

          {draft && (
            <div className="space-y-5 px-4 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="routine-title">Name</Label>
                <Input
                  id="routine-title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  placeholder="Morning review"
                  maxLength={200}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="routine-frequency">Repeats</Label>
                  <select
                    id="routine-frequency"
                    className={selectClass}
                    value={draft.frequency}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        frequency: event.target
                          .value as RoutineItem["frequency"],
                      })
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="routine-interval">Every</Label>
                  <Input
                    id="routine-interval"
                    type="number"
                    min={1}
                    max={365}
                    value={draft.interval}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        interval: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </div>
              </div>

              {draft.frequency === "weekly" && (
                <div className="space-y-1.5">
                  <Label>On days</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {weekdays.map((day) => {
                      const selected = draft.byWeekday.includes(day.value);
                      return (
                        <Button
                          key={day.value}
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          aria-pressed={selected}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              byWeekday: selected
                                ? draft.byWeekday.filter(
                                    (value) => value !== day.value,
                                  )
                                : [...draft.byWeekday, day.value],
                            })
                          }
                        >
                          {day.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {draft.frequency === "monthly" && (
                <div className="space-y-1.5">
                  <Label htmlFor="routine-monthday">Day of month</Label>
                  <Input
                    id="routine-monthday"
                    type="number"
                    min={1}
                    max={31}
                    value={draft.byMonthDay}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        byMonthDay: Number(event.target.value) || 1,
                      })
                    }
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="routine-time">Time of day</Label>
                  <Input
                    id="routine-time"
                    type="time"
                    value={draft.timeOfDay}
                    onChange={(event) =>
                      setDraft({ ...draft, timeOfDay: event.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="routine-estimate">Estimate (minutes)</Label>
                  <Input
                    id="routine-estimate"
                    type="number"
                    min={1}
                    max={1440}
                    value={draft.estimatedMinutes}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        estimatedMinutes: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="routine-priority">Priority</Label>
                <select
                  id="routine-priority"
                  className={selectClass}
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      priority: event.target.value as RoutineItem["priority"],
                    })
                  }
                >
                  {priorities.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>
                  {editing ? "Save routine" : "Create routine"}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
