import { headers } from "next/headers";

/** IANA zone from the edge (Vercel), falling back to the server's own zone. */
export async function getTimeZone(): Promise<string> {
  const headerList = await headers();
  const zone = headerList.get("x-vercel-ip-timezone");

  if (zone && isValidZone(zone)) return zone;

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD` for the current moment in `timeZone`. */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** UTC instants bounding the calendar day `date` in `timeZone`. */
export function dayRangeIn(
  date: string,
  timeZone: string,
): { start: Date; end: Date } {
  const naiveMidnight = new Date(`${date}T00:00:00Z`);
  const start = new Date(
    naiveMidnight.getTime() - offsetMs(naiveMidnight, timeZone),
  );
  const end = new Date(start.getTime() + 86_400_000);

  return { start, end };
}

function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );

  return asUtc - at.getTime();
}
