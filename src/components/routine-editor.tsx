"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StepEditor } from "@/components/step-editor";
import { parseMinutes } from "@/components/task-bits";
import { selectClass } from "@/components/task-detail";
import {
  LinkFields,
  needsLink,
  refreshLinkTargets,
} from "@/components/task-links";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { isoWeekday, today } from "@/lib/dates";
import {
  describeRecurrence,
  fullWeekdayNames,
  lastDayOfMonth,
} from "@/lib/routines";
import {
  priorities,
  type RoutineItem,
  type StepItem,
  taskTypes,
} from "@/lib/types";

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
  notes: string;
  frequency: RoutineItem["frequency"];
  interval: number;
  byWeekday: number[];
  byMonthDay: number;
  monthlyOn: "day" | "last";
  byLastWeekday: number;
  timeOfDay: string;
  estimatedMinutes: string;
  type: RoutineItem["type"];
  parentRoutineId: string | null;
  activityId: string | null;
  priority: RoutineItem["priority"];
  startDate: string;
  endDate: string;
  carryOver: boolean;
  countInTime: boolean;
};

function emptyDraft(): Draft {
  const now = new Date();
  return {
    title: "",
    notes: "",
    frequency: "daily",
    interval: 1,
    byWeekday: [],
    byMonthDay: now.getDate(),
    monthlyOn: "day",
    byLastWeekday: isoWeekday(today()),
    timeOfDay: "",
    estimatedMinutes: "",
    type: "independent",
    parentRoutineId: null,
    activityId: null,
    priority: "none",
    startDate: today(),
    endDate: "",
    carryOver: false,
    countInTime: true,
  };
}

function toDraft(routine: RoutineItem): Draft {
  return {
    title: routine.title,
    notes: routine.notes ?? "",
    frequency: routine.frequency,
    interval: routine.interval,
    byWeekday: routine.byWeekday ?? [],
    byMonthDay: routine.byMonthDay ?? 1,
    monthlyOn: routine.byLastWeekday === null ? "day" : "last",
    byLastWeekday: routine.byLastWeekday ?? isoWeekday(routine.startDate),
    timeOfDay: routine.timeOfDay ?? "",
    estimatedMinutes: String(routine.estimatedMinutes),
    type: routine.type,
    parentRoutineId: routine.parentRoutineId,
    activityId: routine.activityId,
    priority: routine.priority,
    startDate: routine.startDate,
    endDate: routine.endDate ?? "",
    carryOver: routine.carryOver,
    countInTime: routine.countInTime,
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
    const estimatedMinutes = parseMinutes(draft.estimatedMinutes);
    if (estimatedMinutes === null) {
      toast.error("Set a time between 1 and 1440 minutes.");
      return;
    }
    if (needsLink(draft.type) && !draft.parentRoutineId && !draft.activityId) {
      toast.error("Pick a routine or an activity it depends on.");
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      toast.error("The end date must be after the start date.");
      return;
    }

    const body = {
      title,
      notes: draft.notes.trim() || null,
      frequency: draft.frequency,
      interval: draft.interval,
      byWeekday:
        draft.frequency !== "monthly" && draft.byWeekday.length
          ? draft.byWeekday
          : null,
      byMonthDay:
        draft.frequency === "monthly" && draft.monthlyOn === "day"
          ? draft.byMonthDay
          : null,
      byLastWeekday:
        draft.frequency === "monthly" && draft.monthlyOn === "last"
          ? draft.byLastWeekday
          : null,
      timeOfDay: draft.timeOfDay || null,
      estimatedMinutes,
      type: draft.type,
      parentRoutineId: needsLink(draft.type) ? draft.parentRoutineId : null,
      activityId: needsLink(draft.type) ? draft.activityId : null,
      priority: draft.priority,
      startDate: isDateKey(draft.startDate) ? draft.startDate : today(),
      endDate: isDateKey(draft.endDate) ? draft.endDate : null,
      carryOver: draft.carryOver,
      countInTime: draft.countInTime,
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
    void refreshLinkTargets();
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

          <div className="space-y-1.5">
            <Label htmlFor="routine-notes">Notes</Label>
            <Textarea
              id="routine-notes"
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder="Anything to remember"
              maxLength={2000}
              rows={3}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="routine-monthly-on">On</Label>
                <select
                  id="routine-monthly-on"
                  className={selectClass}
                  value={draft.monthlyOn}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      monthlyOn: event.target.value as Draft["monthlyOn"],
                    })
                  }
                >
                  <option value="day">Day of month</option>
                  <option value="last">Last weekday</option>
                </select>
              </div>

              {draft.monthlyOn === "day" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="routine-monthday">Day</Label>
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
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="routine-last-weekday">Last</Label>
                  <select
                    id="routine-last-weekday"
                    className={selectClass}
                    value={draft.byLastWeekday}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        byLastWeekday: Number(event.target.value),
                      })
                    }
                  >
                    {fullWeekdayNames.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                    <option value={lastDayOfMonth}>Last day of month</option>
                  </select>
                </div>
              )}
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

          <label
            htmlFor="routine-carry-over"
            className="flex cursor-pointer items-start gap-3 py-1"
          >
            <Checkbox
              id="routine-carry-over"
              checked={draft.carryOver}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, carryOver: checked === true })
              }
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm leading-none font-medium">
                Carry over if missed
              </span>
              <span className="text-muted-foreground block text-xs">
                Unticked days stay in My Day as overdue until you tick them.
                Off: a missed day simply disappears.
              </span>
            </span>
          </label>

          <label
            htmlFor="routine-count-in-time"
            className="flex cursor-pointer items-start gap-3 py-1"
          >
            <Checkbox
              id="routine-count-in-time"
              checked={draft.countInTime}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, countInTime: checked === true })
              }
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm leading-none font-medium">
                Count in time
              </span>
              <span className="text-muted-foreground block text-xs">
                Include its minutes when time is added up.
              </span>
            </span>
          </label>

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
              <Label htmlFor="routine-estimate">Time (minutes)</Label>
              <Input
                id="routine-estimate"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                required
                placeholder="Required"
                aria-invalid={
                  draft.estimatedMinutes !== "" &&
                  parseMinutes(draft.estimatedMinutes) === null
                }
                value={draft.estimatedMinutes}
                onChange={(event) =>
                  setDraft({ ...draft, estimatedMinutes: event.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="routine-type">Type</Label>
              <select
                id="routine-type"
                className={selectClass}
                value={draft.type}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    type: event.target.value as RoutineItem["type"],
                  })
                }
              >
                {taskTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
          </div>

          {needsLink(draft.type) && (
            <LinkFields
              kind="routine"
              selfId={routine?.id}
              parentId={draft.parentRoutineId}
              activityId={draft.activityId}
              onChange={(parentRoutineId, activityId) =>
                setDraft({ ...draft, parentRoutineId, activityId })
              }
            />
          )}

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
            <Button
              onClick={save}
              disabled={saving || parseMinutes(draft.estimatedMinutes) === null}
            >
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
