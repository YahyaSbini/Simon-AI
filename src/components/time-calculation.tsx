import { asBlockColor, blockColors } from "@/lib/block-colors";
import {
  blocksOn,
  durationOf,
  formatDuration,
  toMinutes,
  weekdays,
} from "@/lib/day-structure";
import type { DayBlockItem, WeekEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type Piece = { from: number; to: number; color: string | null };

const ticks = [0, 6, 12, 18, 24];

/** A day's blocks (overnight ones wrap within the day, as in the grid) and timed events. */
function piecesOn(
  blocks: DayBlockItem[],
  events: WeekEvent[],
  weekday: number,
): Piece[] {
  const pieces: Piece[] = [];
  for (const block of blocksOn(blocks, weekday)) {
    const start = toMinutes(block.start);
    const end = start + durationOf(block);
    pieces.push({ from: start, to: Math.min(end, 1440), color: block.color });
    if (end > 1440)
      pieces.push({ from: 0, to: end - 1440, color: block.color });
  }
  for (const event of events) {
    if (event.weekday !== weekday || event.allDay) continue;
    pieces.push({
      from: event.from,
      to: event.from + event.length,
      color: null,
    });
  }
  return pieces;
}

/** Minutes covered by at least one piece, so overlaps count once. */
function busyMinutes(pieces: Piece[]): number {
  let total = 0;
  let cursor = 0;
  for (const piece of [...pieces].sort((a, b) => a.from - b.from)) {
    const from = Math.max(piece.from, cursor);
    if (piece.to > from) {
      total += piece.to - from;
      cursor = piece.to;
    }
  }
  return total;
}

export function TimeCalculation({
  blocks,
  events,
  dates,
  today,
}: {
  blocks: DayBlockItem[];
  events: WeekEvent[];
  /** Monday-indexed `YYYY-MM-DD` per weekday column. */
  dates: string[];
  today: number;
}) {
  const days = weekdays.map((day) => {
    const pieces = piecesOn(blocks, events, day.value);
    return { day, pieces, busy: busyMinutes(pieces) };
  });
  const weekBusy = days.reduce((sum, { busy }) => sum + busy, 0);

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[7rem_1fr_11rem] gap-4 lg:grid">
        <span />
        <div className="text-muted-foreground relative h-4 text-xs tabular-nums">
          {ticks.map((hour) => (
            <span
              key={hour}
              className={cn(
                "absolute",
                hour === 0
                  ? "left-0"
                  : hour === 24
                    ? "right-0"
                    : "-translate-x-1/2",
              )}
              style={
                hour > 0 && hour < 24
                  ? { left: `${(hour / 24) * 100}%` }
                  : undefined
              }
            >
              {String(hour).padStart(2, "0")}
            </span>
          ))}
        </div>
        <span />
      </div>

      <ul className="space-y-3 lg:space-y-2">
        {days.map(({ day, pieces, busy }) => {
          const date = dates[day.value - 1];
          const isToday = day.value === today;
          return (
            <li
              key={day.value}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 lg:grid-cols-[7rem_1fr_11rem]"
            >
              <span
                className={cn(
                  "col-start-1 row-start-1 text-sm",
                  isToday
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {day.label}
                {date && (
                  <span className="ml-1.5 text-xs tabular-nums">
                    {Number(date.slice(8))}
                  </span>
                )}
              </span>
              <div
                className="bg-muted relative col-span-2 row-start-2 h-3 overflow-hidden rounded-full lg:col-span-1 lg:col-start-2 lg:row-start-1"
                role="img"
                aria-label={`${day.label}: ${formatDuration(busy)} busy, ${formatDuration(1440 - busy)} free`}
              >
                {[...ticks.slice(1, -1)].map((hour) => (
                  <span
                    key={hour}
                    className="bg-border absolute inset-y-0 w-px"
                    style={{ left: `${(hour / 24) * 100}%` }}
                    aria-hidden
                  />
                ))}
                {pieces.map((piece, index) => (
                  <span
                    key={index}
                    className={cn(
                      "absolute inset-y-0",
                      piece.color === null && "bg-azure/45",
                    )}
                    style={{
                      left: `${(piece.from / 1440) * 100}%`,
                      width: `${((piece.to - piece.from) / 1440) * 100}%`,
                      ...(piece.color !== null && {
                        backgroundColor: blockColors[asBlockColor(piece.color)],
                      }),
                    }}
                    aria-hidden
                  />
                ))}
              </div>
              <span className="text-muted-foreground col-start-2 row-start-1 text-right text-xs tabular-nums lg:col-start-3">
                <span className="text-foreground">{formatDuration(busy)}</span>{" "}
                busy · {formatDuration(1440 - busy)} free
              </span>
            </li>
          );
        })}
      </ul>

      <p className="border-border text-muted-foreground flex justify-between border-t pt-2 text-sm tabular-nums">
        <span>Week</span>
        <span>
          <span className="text-foreground">{formatDuration(weekBusy)}</span>{" "}
          busy · {formatDuration(7 * 1440 - weekBusy)} free
        </span>
      </p>
    </div>
  );
}
