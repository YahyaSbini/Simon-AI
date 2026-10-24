"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fill } from "@/components/activity-fields";
import {
  CollapseBody,
  CollapseToggle,
  useClosedSections,
} from "@/components/collapsible";
import { Input } from "@/components/ui/input";
import {
  blocksOn,
  durationOf,
  formatDuration,
  fromMinutes,
  slotsFor,
  toMinutes,
  weekdays,
} from "@/lib/day-structure";
import type {
  ActivityItem,
  CalendarWeek,
  DayBlockItem,
  WeekEvent,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function titleOf(block: Pick<DayBlockItem, "emoji" | "label">): string {
  return [block.emoji, block.label].filter(Boolean).join(" ");
}

type Draft = {
  weekdays: number[];
  start: string;
  end: string;
  activityId: string | null;
};

const presets = {
  weekdays: [1, 2, 3, 4, 5],
  weekend: [6, 7],
  all: [1, 2, 3, 4, 5, 6, 7],
};

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && b.every((day) => a.includes(day));
}

function shortDays(days: number[]): string {
  return weekdays
    .filter((day) => days.includes(day.value))
    .map((day) => day.short)
    .join(", ");
}

function daysLabel(days: number[]): string {
  if (sameSet(days, presets.all)) return "Every day";
  if (sameSet(days, presets.weekdays)) return "Weekdays";
  if (sameSet(days, presets.weekend)) return "Weekend";
  return shortDays(days);
}

function dayName(day: number): string {
  return weekdays.find((item) => item.value === day)?.label ?? "";
}

type Range = { day: number; from: number; to: number };

type Composer =
  | { mode: "new"; range: Range }
  | { mode: "edit"; block: DayBlockItem; day: number };

export function DayStructureView({
  initialBlocks,
  activities,
  alsoDuring,
  today,
  week,
}: {
  initialBlocks: DayBlockItem[];
  activities: ActivityItem[];
  /** Activity id → ids of activities attached to it in Time Investment. */
  alsoDuring: Record<string, string[]>;
  today: number;
  week: CalendarWeek;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [day, setDay] = useState(today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const latest = useRef(blocks);
  latest.current = blocks;
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0);
    const timer = setTimeout(
      () => router.refresh(),
      midnight.getTime() - now.getTime(),
    );
    return () => clearTimeout(timer);
  }, [router, today]);

  const visible = useMemo(() => blocksOn(blocks, day), [blocks, day]);
  const slots = useMemo(() => slotsFor(visible), [visible]);
  const planned = visible.reduce((sum, block) => sum + durationOf(block), 0);

  function selectDay(value: number) {
    setDay(value);
    setEditingId(null);
    setCopying(false);
  }

  async function createBlock(draft: Draft) {
    setSaving(true);
    const response = await fetch("/api/day-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Couldn't add that block.");
      return false;
    }

    const { block } = await response.json();
    setBlocks((current) => [...current, block]);
    return true;
  }

  async function updateBlock(id: string, patch: Partial<Draft>) {
    const previous = latest.current.find((block) => block.id === id);
    const source = activities.find((item) => item.id === patch.activityId);
    const linked = source
      ? { label: source.name, emoji: source.emoji, color: source.color }
      : {};
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...patch, ...linked } : block,
      ),
    );

    const response = await fetch(`/api/day-blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      toast.error("Couldn't save that block.");
      if (previous) {
        setBlocks((current) =>
          current.map((block) => (block.id === id ? previous : block)),
        );
      }
      return false;
    }
    return true;
  }

  /** Take `block` off `from`; delete it once no days are left. */
  async function removeBlock(block: DayBlockItem, from: number) {
    const remaining = block.weekdays.filter((value) => value !== from);
    if (remaining.length) {
      return updateBlock(block.id, { weekdays: remaining });
    }

    const previous = latest.current;
    setBlocks((current) => current.filter((item) => item.id !== block.id));
    const response = await fetch(`/api/day-blocks/${block.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Couldn't remove that block.");
      setBlocks(previous);
      return false;
    }
    return true;
  }

  async function copyTo(targets: number[]) {
    setSaving(true);
    const results = await Promise.all(
      visible.map((block) =>
        updateBlock(block.id, {
          weekdays: [...new Set([...block.weekdays, ...targets])].sort(),
        }),
      ),
    );
    setSaving(false);
    setCopying(false);
    if (results.every(Boolean)) {
      toast.success(`Copied to ${shortDays(targets)}.`);
    }
  }

  const composing = composer?.mode === "new" ? composer.range : null;
  const { closed, setOpen } = useClosedSections("time-day-structure-closed");
  const weekOpen = !closed.has("week");
  const dayOpen = !closed.has("day");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
            <CollapseToggle
              open={weekOpen}
              controls="day-structure-week"
              onToggle={() => setOpen(["week"], !weekOpen)}
            >
              Week
            </CollapseToggle>
          </h2>
          {week.connected && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {week.failed ? (
                "Couldn't load Google Calendar events."
              ) : (
                <>
                  <span
                    className="border-azure bg-card size-3 rounded-[3px] border border-l-[3px]"
                    aria-hidden
                  />
                  Google Calendar · this week
                </>
              )}
            </p>
          )}
        </div>
        <CollapseBody id="day-structure-week" open={weekOpen}>
          <WeekGrid
            blocks={blocks}
            events={week.events}
            dates={week.dates}
            selected={day}
            today={today}
            pending={composing}
            onSelectDay={selectDay}
            onPickBlock={(value, block) => {
              selectDay(value);
              setComposer({ mode: "edit", block, day: value });
            }}
            onCreate={(range) => {
              selectDay(range.day);
              setComposer({ mode: "new", range });
            }}
          />
        </CollapseBody>
      </section>

      <Dialog
        open={composer !== null}
        onOpenChange={(open) => !open && setComposer(null)}
      >
        {composer && (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {composer.mode === "new" ? "New block" : "Edit block"}
              </DialogTitle>
            </DialogHeader>
            <BlockForm
              activities={activities}
              alsoDuring={alsoDuring}
              initial={
                composer.mode === "new"
                  ? {
                      weekdays: [composer.range.day],
                      start: fromMinutes(composer.range.from),
                      end: fromMinutes(composer.range.to),
                      activityId: null,
                    }
                  : draftOf(composer.block)
              }
              current={composer.mode === "edit" ? composer.block : undefined}
              submitLabel={composer.mode === "new" ? "Add block" : "Save"}
              saving={saving}
              autoFocus
              onSubmit={async (draft) => {
                const ok =
                  composer.mode === "new"
                    ? await createBlock(draft)
                    : await updateBlock(composer.block.id, draft);
                if (ok) setComposer(null);
                return ok;
              }}
              extra={
                composer.mode === "edit" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="hover:text-destructive text-muted-foreground"
                    onClick={async () => {
                      const ok = await removeBlock(
                        composer.block,
                        composer.day,
                      );
                      if (ok) setComposer(null);
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    {composer.block.weekdays.length > 1
                      ? `Remove from ${dayName(composer.day)}`
                      : "Delete"}
                  </Button>
                )
              }
            />
          </DialogContent>
        )}
      </Dialog>

      <section className="space-y-3">
        <div className="border-border flex items-end justify-between gap-3 border-b pb-2">
          <div>
            <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
              <CollapseToggle
                open={dayOpen}
                controls="day-structure-day"
                count={visible.length}
                onToggle={() => setOpen(["day"], !dayOpen)}
              >
                {dayName(day)}
              </CollapseToggle>
            </h2>
            {visible.length > 0 && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {visible.length} block{visible.length === 1 ? "" : "s"} ·{" "}
                {formatDuration(planned)} planned
              </p>
            )}
          </div>
          {dayOpen && visible.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCopying((value) => !value)}
              aria-expanded={copying}
            >
              <Copy data-icon="inline-start" />
              Copy to…
            </Button>
          )}
        </div>

        <CollapseBody
          id="day-structure-day"
          open={dayOpen}
          className="space-y-3"
        >
          {copying && (
            <CopyPicker
              exclude={[day]}
              saving={saving}
              onCopy={copyTo}
              onClose={() => setCopying(false)}
            />
          )}

          {visible.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No blocks on {dayName(day)} yet. Click the table or add one below.
            </p>
          ) : (
            <ul className="flex flex-col">
              {slots.map((slot) =>
                slot.kind === "gap" ? (
                  <li
                    key={`gap-${slot.start}`}
                    className="text-muted-foreground flex items-center gap-3 px-2 py-1 text-xs"
                  >
                    <span className="w-24 shrink-0 tabular-nums sm:w-28">
                      {slot.start} – {slot.end}
                    </span>
                    <span className="border-border flex-1 border-t border-dashed" />
                    <span>free · {formatDuration(slot.minutes)}</span>
                  </li>
                ) : editingId === slot.block.id ? (
                  <li key={slot.block.id} className="py-1">
                    <BlockForm
                      activities={activities}
                      alsoDuring={alsoDuring}
                      current={slot.block}
                      initial={draftOf(slot.block)}
                      submitLabel="Save"
                      compact
                      autoFocus
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (draft) => {
                        const ok = await updateBlock(slot.block.id, draft);
                        if (ok) setEditingId(null);
                        return ok;
                      }}
                    />
                  </li>
                ) : (
                  <li
                    key={slot.block.id}
                    className="group/row hover:bg-muted/50 focus-within:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={fill(slot.block.color)}
                      aria-hidden
                    />
                    <span className="w-[5.5rem] shrink-0 text-sm tabular-nums sm:w-[6.5rem]">
                      {slot.block.start} – {slot.block.end}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">
                        {titleOf(slot.block)}
                      </span>
                      {slot.block.weekdays.length > 1 && (
                        <span className="text-muted-foreground block text-xs">
                          {daysLabel(slot.block.weekdays)}
                        </span>
                      )}
                    </span>
                    {slot.overlaps && (
                      <span className="text-destructive shrink-0 text-xs">
                        overlaps
                      </span>
                    )}
                    <span className="text-muted-foreground hidden w-14 shrink-0 text-right text-xs tabular-nums sm:block">
                      {formatDuration(durationOf(slot.block))}
                    </span>
                    <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${titleOf(slot.block)}`}
                        onClick={() => setEditingId(slot.block.id)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-destructive"
                        aria-label={`Remove ${titleOf(slot.block)}`}
                        onClick={() => removeBlock(slot.block, day)}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}

          <div className="pt-2">
            <BlockForm
              key={`${day}-${nextStart(visible)}`}
              activities={activities}
              alsoDuring={alsoDuring}
              initial={{
                weekdays: [day],
                start: nextStart(visible),
                end: nextEnd(visible),
                activityId: null,
              }}
              submitLabel="Add block"
              saving={saving}
              resetOnSubmit
              onSubmit={createBlock}
            />
          </div>
        </CollapseBody>
      </section>
    </div>
  );
}

function draftOf(block: DayBlockItem): Draft {
  return {
    weekdays: block.weekdays,
    start: block.start,
    end: block.end,
    activityId: block.activityId,
  };
}

function nextStart(blocks: DayBlockItem[]): string {
  if (!blocks.length) return "09:00";
  const last = blocks[blocks.length - 1];
  return last.end;
}

function nextEnd(blocks: DayBlockItem[]): string {
  const start = toMinutes(nextStart(blocks));
  const hours = Math.floor(((start + 60) % 1440) / 60);
  return `${String(hours).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
}

function BlockForm({
  activities,
  alsoDuring,
  current,
  initial,
  submitLabel,
  saving = false,
  compact = false,
  autoFocus = false,
  resetOnSubmit = false,
  onSubmit,
  onCancel,
  extra,
}: {
  activities: ActivityItem[];
  alsoDuring: Record<string, string[]>;
  /** The block being edited, shown while it isn't linked to an activity. */
  current?: DayBlockItem;
  initial: Draft;
  submitLabel: string;
  saving?: boolean;
  /** Icon-only actions on a muted background, for editing inside the list. */
  compact?: boolean;
  autoFocus?: boolean;
  resetOnSubmit?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [panel, setPanel] = useState<"activity" | "days" | null>(
    autoFocus && !initial.activityId ? "activity" : null,
  );
  const chosen = activities.find((item) => item.id === draft.activityId);
  const attached = (chosen ? (alsoDuring[chosen.id] ?? []) : [])
    .map((id) => activities.find((item) => item.id === id))
    .filter((item) => item !== undefined);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) {
      toast.error("Choose an activity.");
      setPanel("activity");
      return;
    }
    if (draft.start === draft.end) {
      toast.error("Start and end can't be the same time.");
      return;
    }
    const ok = await onSubmit(draft);
    if (ok && resetOnSubmit) {
      setDraft({ ...draft, activityId: null });
      setPanel(null);
    }
  }

  function pickActivity(activityId: string) {
    setDraft({ ...draft, activityId });
    setPanel(null);
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md",
        compact && "bg-muted/50 -mx-2 px-2 py-2",
      )}
    >
      <Button
        type="button"
        variant="outline"
        aria-label={`Days: ${daysLabel(draft.weekdays)}`}
        aria-expanded={panel === "days"}
        onClick={() => setPanel((value) => (value === "days" ? null : "days"))}
        className="max-w-48 shrink-0"
      >
        <CalendarDays data-icon="inline-start" />
        <span className="truncate">{daysLabel(draft.weekdays)}</span>
      </Button>
      <div className="flex items-center gap-1.5">
        <Input
          type="time"
          value={draft.start}
          onChange={(event) =>
            setDraft({ ...draft, start: event.target.value })
          }
          aria-label="Start time"
          required
          className="w-[7.5rem] tabular-nums"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="time"
          value={draft.end}
          onChange={(event) => setDraft({ ...draft, end: event.target.value })}
          aria-label="End time"
          required
          className="w-[7.5rem] tabular-nums"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        aria-label={`Activity: ${chosen ? chosen.name : "none"}`}
        aria-expanded={panel === "activity"}
        onClick={() =>
          setPanel((value) => (value === "activity" ? null : "activity"))
        }
        className="min-w-48 flex-1 justify-start"
      >
        {chosen ? (
          <>
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={fill(chosen.color)}
              aria-hidden
            />
            <span className="truncate">
              {titleOf({ ...chosen, label: chosen.name })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground truncate">
            {current && !current.activityId
              ? `${titleOf(current)} · choose an activity`
              : "Choose an activity"}
          </span>
        )}
        <ChevronDown className="text-muted-foreground ml-auto" />
      </Button>
      <div className="flex flex-1 items-center justify-end gap-1">
        {extra && <div className="mr-auto">{extra}</div>}
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel"
            onClick={onCancel}
          >
            <X />
          </Button>
        )}
        <Button
          type="submit"
          size={compact ? "icon" : "default"}
          disabled={saving}
          aria-label={compact ? submitLabel : undefined}
        >
          {compact ? (
            <Check />
          ) : (
            <>
              <Plus data-icon="inline-start" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
      {attached.length > 0 && (
        <p className="text-muted-foreground basis-full text-sm">
          Also during this:{" "}
          {attached
            .map((item) => titleOf({ ...item, label: item.name }))
            .join(", ")}
        </p>
      )}
      {panel === "activity" && (
        <ActivityPicker
          activities={activities}
          value={draft.activityId}
          onPick={pickActivity}
        />
      )}
      {panel === "days" && (
        <DaysPicker
          value={draft.weekdays}
          onChange={(weekdays) => setDraft({ ...draft, weekdays })}
        />
      )}
    </form>
  );
}

function ActivityPicker({
  activities,
  value,
  onPick,
}: {
  activities: ActivityItem[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="border-border bg-card animate-in fade-in-0 slide-in-from-top-1 basis-full space-y-2 rounded-md border p-2 duration-150">
      {activities.length === 0 ? (
        <p className="text-muted-foreground px-1 py-2 text-sm">
          No activities yet.{" "}
          <Link
            href="/time/activities"
            className="text-foreground underline underline-offset-4"
          >
            Add your activities
          </Link>{" "}
          first, then place them here.
        </p>
      ) : (
        <>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Activities"
          >
            {activities.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={value === item.id ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={value === item.id}
                onClick={() => onPick(item.id)}
                className={cn(value === item.id && "ring-ring/40 ring-1")}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={fill(item.color)}
                  aria-hidden
                />
                {titleOf({ ...item, label: item.name })}
              </Button>
            ))}
          </div>
          <Link
            href="/time/activities"
            className="text-muted-foreground hover:text-foreground inline-block px-1 text-xs underline-offset-4 hover:underline"
          >
            Manage activities
          </Link>
        </>
      )}
    </div>
  );
}

function DaysPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  function toggle(day: number) {
    if (value.includes(day)) {
      if (value.length > 1) onChange(value.filter((item) => item !== day));
      return;
    }
    onChange([...value, day].sort());
  }

  return (
    <div className="border-border bg-card animate-in fade-in-0 slide-in-from-top-1 flex basis-full flex-wrap items-center gap-2 rounded-md border p-2 duration-150">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Days">
        {weekdays.map((day) => {
          const selected = value.includes(day.value);
          return (
            <Button
              key={day.value}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              aria-label={day.label}
              onClick={() => toggle(day.value)}
              className="w-12"
            >
              {day.short}
            </Button>
          );
        })}
      </div>
      <div className="flex gap-1">
        {(
          [
            ["Weekdays", presets.weekdays],
            ["Weekend", presets.weekend],
            ["Every day", presets.all],
          ] as const
        ).map(([label, set]) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground",
              sameSet(value, set) && "text-foreground bg-muted",
            )}
            onClick={() => onChange([...set])}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function CopyPicker({
  exclude,
  saving,
  onCopy,
  onClose,
}: {
  exclude: number[];
  saving: boolean;
  onCopy: (days: number[]) => void;
  onClose: () => void;
}) {
  const [targets, setTargets] = useState<number[]>([]);

  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm">
      <span className="text-muted-foreground">Copy these blocks to</span>
      <div className="flex flex-wrap gap-1">
        {weekdays
          .filter((day) => !exclude.includes(day.value))
          .map((day) => {
            const selected = targets.includes(day.value);
            return (
              <Button
                key={day.value}
                type="button"
                size="xs"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                onClick={() =>
                  setTargets((current) =>
                    selected
                      ? current.filter((value) => value !== day.value)
                      : [...current, day.value].sort(),
                  )
                }
              >
                {day.short}
              </Button>
            );
          })}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!targets.length || saving}
          onClick={() => onCopy(targets)}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

const hourHeight = 32;
const dayHeight = hourHeight * 24;

type Placed = { from: number; length: number; lane: number; lanes: number };

/** Put overlapping pieces side by side in lanes; mutates and returns `pieces`. */
function assignLanes<T extends Placed>(pieces: T[]): T[] {
  pieces.sort((a, b) => a.from - b.from || b.length - a.length);

  let cluster: T[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const piece of cluster) piece.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const piece of pieces) {
    if (piece.from >= clusterEnd) closeCluster();
    const free = laneEnds.findIndex((end) => end <= piece.from);
    piece.lane = free === -1 ? laneEnds.length : free;
    laneEnds[piece.lane] = piece.from + piece.length;
    clusterEnd = Math.max(clusterEnd, piece.from + piece.length);
    cluster.push(piece);
  }
  closeCluster();

  return pieces;
}

type Segment = Placed & { key: string; block: DayBlockItem };

function segmentsOf(block: DayBlockItem): [number, number][] {
  const start = toMinutes(block.start);
  const duration = durationOf(block);
  return start + duration > 1440
    ? [
        [start, 1440 - start],
        [0, start + duration - 1440],
      ]
    : [[start, duration]];
}

function layoutDay(blocks: DayBlockItem[]): Segment[] {
  return assignLanes(
    blocks.flatMap((block) =>
      segmentsOf(block).map(([from, length], index) => ({
        key: `${block.id}-${index}`,
        block,
        from,
        length,
        lane: 0,
        lanes: 1,
      })),
    ),
  );
}

type PlacedEvent = Placed & { event: WeekEvent };

const snap = 15;

function minuteAt(event: React.PointerEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const minute = ((event.clientY - rect.top) / hourHeight) * 60;
  return Math.min(Math.max(minute, 0), 1440);
}

/** A click (no drag) makes a one-hour block starting at the half hour. */
function clickRange(day: number, minute: number): Range {
  const from = Math.min(Math.floor(minute / 30) * 30, 1410);
  return { day, from, to: Math.min(from + 60, 1440) };
}

type Drag = { day: number; anchor: number; current: number; pointer: number };

function WeekGrid({
  blocks,
  events,
  dates,
  selected,
  today,
  pending,
  onSelectDay,
  onPickBlock,
  onCreate,
}: {
  blocks: DayBlockItem[];
  events: WeekEvent[];
  dates: string[];
  selected: number;
  today: number;
  pending: Range | null;
  onSelectDay: (day: number) => void;
  onPickBlock: (day: number, block: DayBlockItem) => void;
  onCreate: (range: Range) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const touch = useRef<{ day: number; x: number; y: number; minute: number }>(
    null,
  );

  const columns = useMemo(
    () =>
      weekdays.map((day) => ({
        day,
        segments: layoutDay(blocksOn(blocks, day.value)),
        timed: assignLanes<PlacedEvent>(
          events
            .filter((event) => event.weekday === day.value && !event.allDay)
            .map((event) => ({
              event,
              from: event.from,
              length: event.length,
              lane: 0,
              lanes: 1,
            })),
        ),
        allDay: events.filter(
          (event) => event.weekday === day.value && event.allDay,
        ),
      })),
    [blocks, events],
  );
  const hasAllDay = columns.some((column) => column.allDay.length > 0);

  const dragRange: Range | null = drag
    ? {
        day: drag.day,
        from: Math.min(drag.anchor, drag.current),
        to: Math.max(drag.anchor, drag.current),
      }
    : null;
  const ghost =
    dragRange && dragRange.to - dragRange.from >= snap ? dragRange : pending;

  function startPointer(
    event: React.PointerEvent<HTMLDivElement>,
    day: number,
  ) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-item]")) return;
    const minute = minuteAt(event);

    if (event.pointerType === "mouse") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const anchor = Math.floor(minute / snap) * snap;
      setDrag({ day, anchor, current: anchor, pointer: event.pointerId });
    } else {
      touch.current = { day, x: event.clientX, y: event.clientY, minute };
    }
  }

  function movePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointer !== event.pointerId) return;
    const current = Math.round(minuteAt(event) / snap) * snap;
    if (current !== drag.current) setDrag({ ...drag, current });
  }

  function endPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (drag && drag.pointer === event.pointerId) {
      setDrag(null);
      if (dragRange && dragRange.to - dragRange.from >= snap) {
        onCreate(dragRange);
      } else {
        onCreate(clickRange(drag.day, drag.anchor));
      }
      return;
    }

    const start = touch.current;
    touch.current = null;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10
    ) {
      onCreate(clickRange(start.day, start.minute));
    }
  }

  function cancelPointer() {
    setDrag(null);
    touch.current = null;
  }

  return (
    <div className="border-border bg-card overflow-x-auto rounded-md border">
      <div className="grid min-w-[46rem] grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] select-none">
        <div className="bg-card border-border sticky left-0 z-30 border-b" />
        {columns.map(({ day }) => {
          const active = selected === day.value;
          const date = dates[day.value - 1];
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={active}
              aria-label={day.label}
              onClick={() => onSelectDay(day.value)}
              className={cn(
                "border-border focus-visible:ring-ring flex h-10 items-center justify-center gap-1.5 border-b border-l text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset",
                active
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className="sm:hidden">{day.short}</span>
              <span className="hidden sm:inline">{day.label}</span>
              {date && (
                <span
                  className={cn(
                    "tabular-nums",
                    day.value === today
                      ? "bg-azure rounded-full px-1.5 text-xs leading-5 text-white"
                      : "text-muted-foreground text-xs",
                  )}
                >
                  {Number(date.slice(8))}
                </span>
              )}
            </button>
          );
        })}

        {hasAllDay && (
          <>
            <div className="bg-card border-border text-muted-foreground sticky left-0 z-30 flex items-start justify-end border-b px-2 py-1.5 text-[11px]">
              All day
            </div>
            {columns.map(({ day, allDay }) => (
              <div
                key={day.value}
                className="border-border flex min-w-0 flex-col gap-0.5 border-b border-l p-0.5"
              >
                {allDay.map((event) => (
                  <EventChip key={event.key} event={event} />
                ))}
              </div>
            ))}
          </>
        )}

        <div
          className="bg-card text-muted-foreground sticky left-0 z-30 text-[11px] tabular-nums"
          style={{ height: dayHeight }}
          aria-hidden
        >
          <div className="relative h-full">
            {Array.from({ length: 23 }, (_, index) => index + 1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2"
                style={{ top: hour * hourHeight }}
              >
                {String(hour).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        {columns.map(({ day, segments, timed }) => (
          <div
            key={day.value}
            className={cn(
              "border-border relative cursor-cell border-l transition-colors",
              selected === day.value && "bg-muted/40",
            )}
            style={{
              height: dayHeight,
              backgroundImage:
                "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: `100% ${hourHeight}px`,
            }}
            onPointerDown={(event) => startPointer(event, day.value)}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={cancelPointer}
          >
            {segments.map((segment) => {
              const height = (segment.length / 60) * hourHeight;
              const roomy = height >= 36;
              return (
                <button
                  key={segment.key}
                  type="button"
                  data-item
                  title={`${titleOf(segment.block)} · ${segment.block.start} – ${segment.block.end}`}
                  aria-label={`${titleOf(segment.block)}, ${segment.block.start} to ${segment.block.end}`}
                  onClick={() => onPickBlock(day.value, segment.block)}
                  className={cn(
                    "focus-visible:ring-ring absolute flex cursor-pointer overflow-hidden rounded px-1.5 text-left text-xs leading-tight shadow-xs outline-none hover:brightness-110 focus-visible:ring-2",
                    roomy ? "flex-col justify-start py-1" : "items-center",
                  )}
                  style={{
                    ...fill(segment.block.color),
                    top: (segment.from / 60) * hourHeight + 1,
                    height: Math.max(height - 2, 14),
                    left: `calc(${(segment.lane / segment.lanes) * 100}% + 2px)`,
                    width: `calc(${100 / segment.lanes}% - 4px)`,
                  }}
                >
                  <span className="flex w-full min-w-0 items-center gap-1">
                    {segment.block.emoji && (
                      <span className="shrink-0 text-sm leading-none">
                        {segment.block.emoji}
                      </span>
                    )}
                    {segment.block.label && (
                      <span className="truncate font-medium">
                        {segment.block.label}
                      </span>
                    )}
                  </span>
                  {roomy && (
                    <span className="mt-0.5 truncate tabular-nums opacity-80">
                      {segment.block.start} – {segment.block.end}
                    </span>
                  )}
                </button>
              );
            })}

            {timed.map((piece) => {
              const height = (piece.length / 60) * hourHeight;
              const share = 74 / piece.lanes;
              return (
                <EventChip
                  key={piece.event.key}
                  event={piece.event}
                  className="absolute z-10"
                  style={{
                    top: (piece.from / 60) * hourHeight + 1,
                    height: Math.max(height - 2, 16),
                    left: `calc(${24 + piece.lane * share}% + 1px)`,
                    width: `calc(${share}% - 3px)`,
                  }}
                  showTime={height >= 36}
                />
              );
            })}

            {ghost && ghost.day === day.value && (
              <div
                className="border-azure bg-azure/15 text-foreground pointer-events-none absolute inset-x-0.5 z-20 rounded border px-1.5 py-0.5 text-xs tabular-nums"
                style={{
                  top: (ghost.from / 60) * hourHeight + 1,
                  height: Math.max(
                    ((ghost.to - ghost.from) / 60) * hourHeight - 2,
                    14,
                  ),
                }}
                aria-hidden
              >
                {fromMinutes(ghost.from)} – {fromMinutes(ghost.to)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventChip({
  event,
  className,
  style,
  showTime = false,
}: {
  event: WeekEvent;
  className?: string;
  style?: React.CSSProperties;
  showTime?: boolean;
}) {
  const time = event.allDay
    ? "All day"
    : `${fromMinutes(event.from)} – ${fromMinutes(event.from + event.length)}`;
  const content = (
    <>
      <span className="truncate font-medium">{event.title}</span>
      {showTime && (
        <span className="text-muted-foreground truncate tabular-nums">
          {time}
        </span>
      )}
    </>
  );
  const classes = cn(
    "border-azure bg-card text-foreground ring-border flex min-w-0 flex-col overflow-hidden rounded-[3px] border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-xs ring-1 transition-colors",
    event.url &&
      "hover:bg-muted focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2",
    className,
  );
  const label = `${event.title}, ${time} (Google Calendar)`;

  return event.url ? (
    <a
      href={event.url}
      target="_blank"
      rel="noreferrer"
      data-item
      title={`${event.title} · ${time}`}
      aria-label={label}
      className={classes}
      style={style}
    >
      {content}
    </a>
  ) : (
    <div
      data-item
      title={`${event.title} · ${time}`}
      aria-label={label}
      className={classes}
      style={style}
    >
      {content}
    </div>
  );
}
