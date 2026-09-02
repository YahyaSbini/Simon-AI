/** Calendar-day helpers. Dates are handled as local `YYYY-MM-DD` strings. */

export function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function today(): string {
  return toDateKey(new Date());
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function daysBetween(from: string, to: string): number {
  const ms = fromDateKey(to).getTime() - fromDateKey(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: string): number {
  return ((fromDateKey(key).getDay() + 6) % 7) + 1;
}

export function formatDay(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatDue(value: Date): string {
  const key = toDateKey(value);
  const diff = daysBetween(today(), key);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";

  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(value.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" }),
  });
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
