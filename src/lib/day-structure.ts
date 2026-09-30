import type { DayBlockItem } from "@/lib/types";

export const weekdays = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 7, short: "Sun", label: "Sunday" },
] as const;

export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Minutes from `start` to `end`, treating `end <= start` as running overnight. */
export function durationOf(block: Pick<DayBlockItem, "start" | "end">): number {
  const span = toMinutes(block.end) - toMinutes(block.start);
  return span > 0 ? span : span + 1440;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Blocks that apply to a weekday, in start-time order. */
export function blocksOn(
  blocks: DayBlockItem[],
  weekday: number,
): DayBlockItem[] {
  return blocks
    .filter((block) => block.weekdays.includes(weekday))
    .sort(
      (a, b) =>
        toMinutes(a.start) - toMinutes(b.start) ||
        a.label.localeCompare(b.label),
    );
}

export type Slot =
  | { kind: "block"; block: DayBlockItem; overlaps: boolean }
  | { kind: "gap"; start: string; end: string; minutes: number };

/** Interleave a day's blocks with the free time between them and flag overlaps. */
export function slotsFor(blocks: DayBlockItem[]): Slot[] {
  const slots: Slot[] = [];
  let cursor: number | null = null;

  for (const block of blocks) {
    const start = toMinutes(block.start);
    const end = start + durationOf(block);
    const overlaps = cursor !== null && start < cursor;

    if (cursor !== null && start > cursor) {
      slots.push({
        kind: "gap",
        start: fromMinutes(cursor),
        end: block.start,
        minutes: start - cursor,
      });
    }

    slots.push({ kind: "block", block, overlaps });
    cursor = Math.max(cursor ?? 0, end);
  }

  return slots;
}
