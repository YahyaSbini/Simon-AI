"use client";

import { Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  blocksOn,
  durationOf,
  formatDuration,
  slotsFor,
  toMinutes,
  weekdays,
} from "@/lib/day-structure";
import type { DayBlockItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dayBlockColors } from "@/lib/validation";

type Color = (typeof dayBlockColors)[number];

const colorClass: Record<Color, string> = {
  azure: "bg-chart-1",
  wood: "bg-chart-2",
  sage: "bg-chart-3",
  clay: "bg-chart-4",
  slate: "bg-chart-5",
};

const segmentText: Record<Color, string> = {
  azure: "text-white",
  wood: "text-white",
  sage: "text-white dark:text-ink",
  clay: "text-white dark:text-ink",
  slate: "text-white dark:text-ink",
};

function asColor(color: string | null): Color {
  return color && color in colorClass ? (color as Color) : "azure";
}

function swatch(color: string | null): string {
  return colorClass[asColor(color)];
}

type Draft = { start: string; end: string; label: string; color: Color };

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

export function DayStructureView({
  initialBlocks,
  today,
}: {
  initialBlocks: DayBlockItem[];
  today: number;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [days, setDays] = useState<number[]>([today]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const latest = useRef(blocks);
  latest.current = blocks;

  const visible = useMemo(() => {
    const merged = new Map<string, DayBlockItem>();
    for (const day of days) {
      for (const block of blocksOn(blocks, day)) merged.set(block.id, block);
    }
    return [...merged.values()].sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start),
    );
  }, [blocks, days]);

  const slots = useMemo(() => slotsFor(visible), [visible]);
  const planned = visible.reduce((sum, block) => sum + durationOf(block), 0);

  function toggleDay(day: number) {
    setDays((current) => {
      if (current.includes(day)) {
        return current.length === 1
          ? current
          : current.filter((value) => value !== day);
      }
      return [...current, day].sort();
    });
  }

  async function createBlock(draft: Draft) {
    setSaving(true);
    const response = await fetch("/api/day-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, weekdays: days }),
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

  async function updateBlock(id: string, patch: Partial<DayBlockItem>) {
    const previous = latest.current.find((block) => block.id === id);
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...patch } : block,
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

  async function removeBlock(block: DayBlockItem) {
    const remaining = block.weekdays.filter((day) => !days.includes(day));
    if (remaining.length) {
      await updateBlock(block.id, { weekdays: remaining });
      return;
    }

    const previous = blocks;
    setBlocks((current) => current.filter((item) => item.id !== block.id));
    const response = await fetch(`/api/day-blocks/${block.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Couldn't remove that block.");
      setBlocks(previous);
    }
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

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Week
          </p>
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
                size="xs"
                className={cn(
                  "text-muted-foreground",
                  sameSet(days, set) && "text-foreground bg-muted",
                )}
                onClick={() => setDays([...set])}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <WeekGrid
          blocks={blocks}
          selected={days}
          today={today}
          onToggleDay={toggleDay}
          onPickBlock={(day, block) => {
            setDays([day]);
            setEditingId(block.id);
          }}
        />
      </section>

      <section className="space-y-3">
        <div className="border-border flex items-end justify-between gap-3 border-b pb-2">
          <div>
            <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
              {days.length === 1
                ? weekdays.find((day) => day.value === days[0])?.label
                : shortDays(days)}
            </h2>
            {visible.length > 0 && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {visible.length} block{visible.length === 1 ? "" : "s"} ·{" "}
                {formatDuration(planned)} planned
              </p>
            )}
          </div>
          {visible.length > 0 && (
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

        {copying && (
          <CopyPicker
            exclude={days}
            saving={saving}
            onCopy={copyTo}
            onClose={() => setCopying(false)}
          />
        )}

        {visible.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No blocks yet for {days.length === 1 ? "this day" : "these days"}.
            Add the first one below.
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
                    initial={{
                      start: slot.block.start,
                      end: slot.block.end,
                      label: slot.block.label,
                      color: asColor(slot.block.color),
                    }}
                    submitLabel="Save"
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
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      swatch(slot.block.color),
                    )}
                    aria-hidden
                  />
                  <span className="w-[5.5rem] shrink-0 text-sm tabular-nums sm:w-[6.5rem]">
                    {slot.block.start} – {slot.block.end}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">
                      {slot.block.label}
                    </span>
                    {!sameSet(
                      slot.block.weekdays.filter((day) => days.includes(day)),
                      days,
                    ) && (
                      <span className="text-muted-foreground block text-xs">
                        {shortDays(slot.block.weekdays)} only
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
                      aria-label={`Edit ${slot.block.label}`}
                      onClick={() => setEditingId(slot.block.id)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="hover:text-destructive"
                      aria-label={`Remove ${slot.block.label}`}
                      onClick={() => removeBlock(slot.block)}
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
            key={nextStart(visible)}
            initial={{
              start: nextStart(visible),
              end: nextEnd(visible),
              label: "",
              color: "azure",
            }}
            submitLabel="Add block"
            saving={saving}
            onSubmit={createBlock}
          />
        </div>
      </section>
    </div>
  );
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
  initial,
  submitLabel,
  saving = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  saving?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const editing = Boolean(onCancel);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = draft.label.trim();
    if (!label) {
      toast.error("Give the block a name.");
      return;
    }
    if (draft.start === draft.end) {
      toast.error("Start and end can't be the same time.");
      return;
    }
    const ok = await onSubmit({ ...draft, label });
    if (ok && !editing) {
      setDraft({ ...draft, label: "" });
    }
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md",
        editing && "bg-muted/50 -mx-2 px-2 py-2",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Input
          type="time"
          value={draft.start}
          onChange={(event) =>
            setDraft({ ...draft, start: event.target.value })
          }
          aria-label="Start time"
          required
          className="w-[6.5rem] tabular-nums"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="time"
          value={draft.end}
          onChange={(event) => setDraft({ ...draft, end: event.target.value })}
          aria-label="End time"
          required
          className="w-[6.5rem] tabular-nums"
        />
      </div>
      <Input
        value={draft.label}
        onChange={(event) => setDraft({ ...draft, label: event.target.value })}
        placeholder="What happens then? e.g. Work, Gym, Sleep"
        aria-label="Block name"
        maxLength={80}
        autoFocus={editing}
        className="min-w-40 flex-1"
      />
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Color"
      >
        {dayBlockColors.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={draft.color === color}
            aria-label={color}
            onClick={() => setDraft({ ...draft, color })}
            className={cn(
              "focus-visible:ring-ring flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2",
            )}
          >
            <span
              className={cn(
                "size-3.5 rounded-full transition-transform",
                colorClass[color],
                draft.color === color &&
                  "ring-foreground/60 scale-125 ring-2 ring-offset-1 ring-offset-background",
              )}
            />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
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
          size={editing ? "icon" : "default"}
          disabled={saving}
          aria-label={editing ? "Save" : undefined}
        >
          {editing ? (
            <Check />
          ) : (
            <>
              <Plus data-icon="inline-start" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
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

function WeekGrid({
  blocks,
  selected,
  today,
  onToggleDay,
  onPickBlock,
}: {
  blocks: DayBlockItem[];
  selected: number[];
  today: number;
  onToggleDay: (day: number) => void;
  onPickBlock: (day: number, block: DayBlockItem) => void;
}) {
  return (
    <div className="space-y-1.5">
      <ul className="flex flex-col gap-1.5">
        {weekdays.map((day) => {
          const active = selected.includes(day.value);
          const dayBlocks = blocksOn(blocks, day.value);
          return (
            <li key={day.value} className="flex items-stretch gap-2">
              <button
                type="button"
                aria-pressed={active}
                aria-label={day.label}
                onClick={() => onToggleDay(day.value)}
                className={cn(
                  "border-border focus-visible:ring-ring w-14 shrink-0 rounded-md border text-sm transition-colors outline-none focus-visible:ring-2 sm:w-16",
                  active
                    ? "border-wood/60 bg-card text-foreground"
                    : "text-muted-foreground hover:bg-muted/50",
                  day.value === today && "font-medium",
                )}
              >
                {day.short}
                {day.value === today && (
                  <span
                    className="bg-azure ml-1 inline-block size-1.5 rounded-full align-middle"
                    aria-hidden
                  />
                )}
              </button>
              <div
                className={cn(
                  "bg-muted/60 relative h-10 min-w-0 flex-1 overflow-hidden rounded-md transition-colors",
                  active && "bg-muted",
                )}
              >
                {dayBlocks.length === 0 && (
                  <span className="text-muted-foreground absolute inset-0 flex items-center px-3 text-xs">
                    –
                  </span>
                )}
                {dayBlocks.map((block) =>
                  segmentsOf(block).map(([from, length], index) => (
                    <button
                      key={`${block.id}-${index}`}
                      type="button"
                      title={`${block.label} · ${block.start} – ${block.end}`}
                      aria-label={`${block.label}, ${block.start} to ${block.end}`}
                      onClick={() => onPickBlock(day.value, block)}
                      className={cn(
                        "focus-visible:ring-ring absolute inset-y-0.5 flex items-center overflow-hidden rounded px-1.5 text-xs whitespace-nowrap outline-none hover:brightness-110 focus-visible:ring-2",
                        swatch(block.color),
                        segmentText[asColor(block.color)],
                      )}
                      style={{
                        left: `${(from / 1440) * 100}%`,
                        width: `calc(${(length / 1440) * 100}% - 2px)`,
                      }}
                    >
                      <span className="truncate">
                        {index === 0 || length >= 120 ? block.label : ""}
                      </span>
                    </button>
                  )),
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div
        className="text-muted-foreground flex pl-16 text-[11px] tabular-nums sm:pl-18"
        aria-hidden
      >
        {[0, 6, 12, 18].map((hour) => (
          <span key={hour} className="flex-1">
            {String(hour).padStart(2, "0")}:00
          </span>
        ))}
        <span>24:00</span>
      </div>
    </div>
  );
}
