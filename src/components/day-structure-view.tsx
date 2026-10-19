"use client";

import { Check, Copy, Pencil, Plus, Smile, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  asBlockColor,
  type BlockColor,
  blockColors,
  textOn,
} from "@/lib/block-colors";
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

type Color = BlockColor;

const emojiChoices = (
  "😴 💤 🌙 ☀️ 💼 💻 🏢 📞 📚 📖 ✍️ 🎓 🧠 🏋️ 🏃 ⚽ 🧘 🕌 🙏 🍳 " +
  "🍽️ ☕ 🚿 🧹 🛒 🚗 ✈️ 🏠 👨‍👩‍👧 💬 🎮 📺 🎵 🎨 🛠️ 🌳 🐾 🩺 💊 💰"
).split(" ");

function fill(color: string | null): React.CSSProperties {
  const key = asBlockColor(color);
  return { backgroundColor: blockColors[key], color: textOn(key) };
}

function titleOf(block: Pick<DayBlockItem, "emoji" | "label">): string {
  return [block.emoji, block.label].filter(Boolean).join(" ");
}

type Draft = {
  start: string;
  end: string;
  label: string;
  emoji: string | null;
  color: Color;
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
                      emoji: slot.block.emoji,
                      color: asBlockColor(slot.block.color),
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
              emoji: null,
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
  const [picking, setPicking] = useState(false);
  const editing = Boolean(onCancel);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = draft.label.trim();
    const emoji = draft.emoji?.trim() || null;
    if (!label && !emoji) {
      toast.error("Give the block a name or an emoji.");
      return;
    }
    if (draft.start === draft.end) {
      toast.error("Start and end can't be the same time.");
      return;
    }
    const ok = await onSubmit({ ...draft, label, emoji });
    if (ok && !editing) {
      setDraft({ ...draft, label: "", emoji: null });
      setPicking(false);
    }
  }

  function pickEmoji(emoji: string | null) {
    setDraft({ ...draft, emoji });
    setPicking(false);
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
      <div className="flex min-w-48 flex-1 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={draft.emoji ? `Emoji ${draft.emoji}` : "Add an emoji"}
          aria-expanded={picking}
          onClick={() => setPicking((value) => !value)}
          className="shrink-0 text-base"
        >
          {draft.emoji ? (
            <span aria-hidden>{draft.emoji}</span>
          ) : (
            <Smile className="text-muted-foreground" />
          )}
        </Button>
        <Input
          value={draft.label}
          onChange={(event) =>
            setDraft({ ...draft, label: event.target.value })
          }
          placeholder="What happens then? e.g. Work, Gym, Sleep"
          aria-label="Block name"
          maxLength={80}
          autoFocus={editing}
          className="min-w-0 flex-1"
        />
      </div>
      <div
        className="flex flex-wrap items-center"
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
            title={color}
            onClick={() => setDraft({ ...draft, color })}
            className="focus-visible:ring-ring flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2"
          >
            <span
              className={cn(
                "size-3.5 rounded-full transition-transform",
                draft.color === color &&
                  "ring-foreground/60 ring-offset-background scale-125 ring-2 ring-offset-1",
              )}
              style={{ backgroundColor: blockColors[color] }}
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
      {picking && (
        <EmojiPicker
          value={draft.emoji}
          onPick={pickEmoji}
          onClose={() => setPicking(false)}
        />
      )}
    </form>
  );
}

function EmojiPicker({
  value,
  onPick,
  onClose,
}: {
  value: string | null;
  onPick: (emoji: string | null) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");

  return (
    <div
      className="border-border bg-card animate-in fade-in-0 slide-in-from-top-1 basis-full space-y-2 rounded-md border p-2 duration-150"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-[repeat(20,minmax(0,1fr))]">
        {emojiChoices.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            aria-pressed={value === emoji}
            onClick={() => onPick(emoji)}
            className={cn(
              "hover:bg-muted focus-visible:ring-ring flex h-9 items-center justify-center rounded-md text-lg transition-colors outline-none focus-visible:ring-2",
              value === emoji && "bg-muted",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (custom.trim()) onPick(custom.trim());
            }
          }}
          placeholder="Or type / paste any emoji"
          aria-label="Custom emoji"
          maxLength={16}
          className="w-52"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!custom.trim()}
          onClick={() => onPick(custom.trim())}
        >
          Use
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto"
            onClick={() => onPick(null)}
          >
            No emoji
          </Button>
        )}
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

type Segment = {
  key: string;
  block: DayBlockItem;
  from: number;
  length: number;
  lane: number;
  lanes: number;
};

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

/** Place a day's segments in side-by-side lanes wherever they overlap. */
function layoutDay(blocks: DayBlockItem[]): Segment[] {
  const pieces = blocks
    .flatMap((block) =>
      segmentsOf(block).map(([from, length], index) => ({
        key: `${block.id}-${index}`,
        block,
        from,
        length,
        lane: 0,
        lanes: 1,
      })),
    )
    .sort((a, b) => a.from - b.from || b.length - a.length);

  const placed: Segment[] = [];
  let cluster: Segment[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const piece of cluster) piece.lanes = laneEnds.length;
    placed.push(...cluster);
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

  return placed;
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
  const columns = useMemo(
    () =>
      weekdays.map((day) => ({
        day,
        segments: layoutDay(blocksOn(blocks, day.value)),
      })),
    [blocks],
  );

  return (
    <div className="border-border bg-card overflow-x-auto rounded-md border">
      <div className="grid min-w-[46rem] grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        <div className="bg-card border-border sticky left-0 z-20 border-b" />
        {columns.map(({ day }) => {
          const active = selected.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={active}
              aria-label={day.label}
              onClick={() => onToggleDay(day.value)}
              className={cn(
                "border-border focus-visible:ring-ring flex h-10 items-center justify-center gap-1.5 border-b border-l text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset",
                active
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className="sm:hidden">{day.short}</span>
              <span className="hidden sm:inline">{day.label}</span>
              {day.value === today && (
                <span className="bg-azure size-1.5 rounded-full" aria-hidden />
              )}
            </button>
          );
        })}

        <div
          className="bg-card text-muted-foreground sticky left-0 z-20 text-[11px] tabular-nums"
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

        {columns.map(({ day, segments }) => (
          <div
            key={day.value}
            className={cn(
              "border-border relative border-l transition-colors",
              selected.includes(day.value) && "bg-muted/40",
            )}
            style={{
              height: dayHeight,
              backgroundImage:
                "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: `100% ${hourHeight}px`,
            }}
          >
            {segments.map((segment) => {
              const height = (segment.length / 60) * hourHeight;
              const roomy = height >= 36;
              return (
                <button
                  key={segment.key}
                  type="button"
                  title={`${titleOf(segment.block)} · ${segment.block.start} – ${segment.block.end}`}
                  aria-label={`${titleOf(segment.block)}, ${segment.block.start} to ${segment.block.end}`}
                  onClick={() => onPickBlock(day.value, segment.block)}
                  className={cn(
                    "focus-visible:ring-ring absolute flex overflow-hidden rounded px-1.5 text-left text-xs leading-tight shadow-xs outline-none hover:brightness-110 focus-visible:ring-2",
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
          </div>
        ))}
      </div>
    </div>
  );
}
