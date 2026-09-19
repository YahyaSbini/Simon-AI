"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StepEditor } from "@/components/step-editor";
import { selectClass } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { today } from "@/lib/dates";
import { describeRecurrence } from "@/lib/routines";
import { priorities, type RoutineItem, type StepItem } from "@/lib/types";

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
  startDate: string;
  endDate: string;
};

function emptyDraft(): Draft {
  const now = new Date();
  return {
    title: "",
    frequency: "daily",
    interval: 1,
    byWeekday: [],
    byMonthDay: now.getDate(),
    timeOfDay: "",
    estimatedMinutes: "",
    priority: "none",
    startDate: today(),
    endDate: "",
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
    startDate: routine.startDate,
    endDate: routine.endDate ?? "",
  };
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Create / edit sheet for a routine. Steps are only available once the
 * routine exists, since they are saved against its id.
 */
export function RoutineEditor({
  open,
  routine,
  date,
  onClose,
  onSaved,
  onStepsChange,
}: {
  open: boolean;
  routine: RoutineItem | null;
  /** Occurrence date step ticks apply to (today in the user's zone). */
  date: string;
  onClose: () => void;
  onSaved: (item: RoutineItem, created: boolean) => void;
  onStepsChange: (routineId: string, steps: StepItem[]) => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const routineId = routine?.id ?? null;
  useEffect(() => {
    if (!open) return;
    // Only reseed when a different routine is opened; step edits must not clobber the draft.
    setDraft(routine ? toDraft(routine) : emptyDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routineId]);

  async function save() {
    const title = draft.title.trim();

    if (!title) {
      toast.error("Give the routine a name.");
      return;
    }
    if (draft.frequency === "weekly" && draft.byWeekday.length === 0) {
      toast.error("Pick at least one day.");
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      toast.error("The end date must be after the start date.");
      return;
    }

    const body = {
      title,
      frequency: draft.frequency,
      interval: draft.interval,
      byWeekday:
        draft.frequency !== "monthly" && draft.byWeekday.length
          ? draft.byWeekday
          : null,
      byMonthDay: draft.frequency === "monthly" ? draft.byMonthDay : null,
      timeOfDay: draft.timeOfDay || null,
      estimatedMinutes: draft.estimatedMinutes
        ? Number(draft.estimatedMinutes)
        : null,
      priority: draft.priority,
      startDate: isDateKey(draft.startDate) ? draft.startDate : today(),
      endDate: isDateKey(draft.endDate) ? draft.endDate : null,
    };

    setSaving(true);
    const response = await fetch(
      routine ? `/api/routines/${routine.id}` : "/api/routines",
      {
        method: routine ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);

    if (!response.ok) {
      toast.error("Couldn't save that routine.");
      return;
    }

    const { routine: saved } = await response.json();
    onSaved(
      {
        ...saved,
        recurrence: describeRecurrence(saved),
        steps: routine?.steps ?? [],
      },
      !routine,
    );
  }

  const showWeekdays = draft.frequency !== "monthly";

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetTitle className="p-4 text-lg">
          {routine ? "Edit routine" : "New routine"}
        </SheetTitle>

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
              autoFocus={!routine}
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
                    frequency: event.target.value as RoutineItem["frequency"],
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

          {showWeekdays && (
            <div className="space-y-1.5">
              <Label>
                On days
                {draft.frequency === "daily" && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · leave empty for every day
                  </span>
                )}
              </Label>
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
              <Label htmlFor="routine-start">From</Label>
              <Input
                id="routine-start"
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  setDraft({ ...draft, startDate: event.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="routine-end">
                To{" "}
                <span className="text-muted-foreground font-normal">
                  · optional
                </span>
              </Label>
              <Input
                id="routine-end"
                type="date"
                value={draft.endDate}
                min={draft.startDate || undefined}
                onChange={(event) =>
                  setDraft({ ...draft, endDate: event.target.value })
                }
              />
            </div>
          </div>

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
                  setDraft({ ...draft, estimatedMinutes: event.target.value })
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

          {routine ? (
            <StepEditor
              steps={routine.steps}
              onChange={(steps) => onStepsChange(routine.id, steps)}
              createUrl={`/api/routines/${routine.id}/steps`}
              stepUrl={(id) => `/api/routine-steps/${id}`}
              tickBody={{ date }}
              inputId="routine-step"
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              You can add steps after creating the routine.
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {routine ? "Save routine" : "Create routine"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
