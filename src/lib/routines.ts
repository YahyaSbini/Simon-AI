import type { Routine } from "@/db/schema";
import { daysBetween, fromDateKey, isoWeekday } from "@/lib/dates";

/** Whether a routine has an occurrence on the given `YYYY-MM-DD` date. */
export function occursOn(routine: Routine, date: string): boolean {
  if (!routine.active) return false;

  const offset = daysBetween(routine.startDate, date);
  if (offset < 0) return false;

  const interval = Math.max(1, routine.interval);

  switch (routine.frequency) {
    case "daily":
      return offset % interval === 0;

    case "weekly": {
      const weekdays = routine.byWeekday?.length
        ? routine.byWeekday
        : [isoWeekday(routine.startDate)];

      if (!weekdays.includes(isoWeekday(date))) return false;

      const weeks = Math.floor(
        daysBetween(startOfWeek(routine.startDate), startOfWeek(date)) / 7,
      );
      return weeks % interval === 0;
    }

    case "monthly": {
      const start = fromDateKey(routine.startDate);
      const current = fromDateKey(date);
      const monthDay = routine.byMonthDay ?? start.getDate();

      if (current.getDate() !== monthDay) return false;

      const months =
        (current.getFullYear() - start.getFullYear()) * 12 +
        (current.getMonth() - start.getMonth());
      return months >= 0 && months % interval === 0;
    }
  }
}

function startOfWeek(date: string): string {
  const value = fromDateKey(date);
  value.setDate(value.getDate() - (isoWeekday(date) - 1));
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function describeRecurrence(routine: Routine): string {
  const every = routine.interval > 1 ? `${routine.interval} ` : "";

  switch (routine.frequency) {
    case "daily":
      return routine.interval > 1 ? `Every ${every}days` : "Every day";
    case "weekly": {
      const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const days = (
        routine.byWeekday?.length
          ? routine.byWeekday
          : [isoWeekday(routine.startDate)]
      )
        .slice()
        .sort((a, b) => a - b)
        .map((day) => names[day - 1])
        .join(", ");
      return routine.interval > 1
        ? `Every ${every}weeks on ${days}`
        : `Weekly on ${days}`;
    }
    case "monthly": {
      const day = routine.byMonthDay ?? fromDateKey(routine.startDate).getDate();
      return routine.interval > 1
        ? `Every ${every}months on day ${day}`
        : `Monthly on day ${day}`;
    }
  }
}
