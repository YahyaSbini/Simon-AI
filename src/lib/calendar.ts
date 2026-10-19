import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { account, calendarEventCompletion } from "@/db/schema";
import { auth, calendarScope, googleConfigured } from "@/lib/auth";
import { dayRangeIn } from "@/lib/timezone";
import type {
  CalendarAgenda,
  CalendarEvent,
  CalendarStatus,
  CalendarWeek,
  WeekEvent,
} from "@/lib/types";

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

async function findGoogleAccount(userId: string) {
  const [row] = await db
    .select({ id: account.id, scope: account.scope })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
    .limit(1);

  return row ?? null;
}

export async function getCalendarStatus(
  userId: string,
): Promise<CalendarStatus> {
  if (!googleConfigured) {
    return { configured: false, connected: false, hasCalendarAccess: false };
  }

  const row = await findGoogleAccount(userId);

  return {
    configured: true,
    connected: row !== null,
    hasCalendarAccess: row?.scope?.includes(calendarScope) ?? false,
  };
}

type GoogleFetch =
  | { connected: false; failed: false; items: [] }
  | { connected: true; failed: boolean; items: GoogleEvent[] };

async function fetchGoogleEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date,
  timeZone: string,
  maxResults: number,
): Promise<GoogleFetch> {
  if (!googleConfigured) {
    return { connected: false, failed: false, items: [] };
  }

  const row = await findGoogleAccount(userId);

  if (!row || !row.scope?.includes(calendarScope)) {
    return { connected: false, failed: false, items: [] };
  }

  let accessToken: string;

  try {
    const token = await auth.api.getAccessToken({
      body: { accountId: row.id, userId },
      headers: await headers(),
    });
    accessToken = token.accessToken;
  } catch {
    return { connected: true, failed: true, items: [] };
  }

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("timeZone", timeZone);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return { connected: true, failed: true, items: [] };
  }

  const payload = (await response.json()) as { items?: GoogleEvent[] };
  const items = (payload.items ?? []).filter(
    (item) => item.status !== "cancelled",
  );

  return { connected: true, failed: false, items };
}

/** Events from the user's primary Google calendar for a single local day. */
export async function getCalendarAgenda(
  userId: string,
  date: string,
  timeZone: string,
): Promise<CalendarAgenda> {
  const { start, end } = dayRangeIn(date, timeZone);
  const result = await fetchGoogleEvents(userId, start, end, timeZone, 50);

  if (!result.connected || result.failed) {
    return { connected: result.connected, failed: result.failed, events: [] };
  }

  const ticked = new Set(
    (
      await db
        .select({ eventId: calendarEventCompletion.eventId })
        .from(calendarEventCompletion)
        .where(
          and(
            eq(calendarEventCompletion.userId, userId),
            eq(calendarEventCompletion.date, date),
          ),
        )
    ).map((row) => row.eventId),
  );

  const events: CalendarEvent[] = result.items
    .filter((item) => !ticked.has(item.id))
    .map((item) => ({
      id: item.id,
      title: item.summary ?? "Untitled event",
      start: item.start?.dateTime ?? null,
      end: item.end?.dateTime ?? null,
      allDay: !item.start?.dateTime,
      location: item.location ?? null,
      url: item.htmlLink ?? null,
    }));

  return { connected: true, failed: false, events };
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Local `YYYY-MM-DD` and minutes since midnight of an instant in `timeZone`. */
function localParts(
  iso: string,
  timeZone: string,
): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: (Number(value("hour")) % 24) * 60 + Number(value("minute")),
  };
}

/** Google events for Monday … Sunday of the week containing `today`, split per day. */
export async function getCalendarWeek(
  userId: string,
  today: string,
  timeZone: string,
): Promise<CalendarWeek> {
  const offset = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = shiftDate(today, -((offset + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, index) =>
    shiftDate(monday, index),
  );
  const weekdayOf = new Map(dates.map((date, index) => [date, index + 1]));

  const result = await fetchGoogleEvents(
    userId,
    dayRangeIn(dates[0], timeZone).start,
    dayRangeIn(dates[6], timeZone).end,
    timeZone,
    250,
  );

  const events: WeekEvent[] = [];

  for (const item of result.items) {
    const title = item.summary ?? "Untitled event";
    const url = item.htmlLink ?? null;

    if (item.start?.dateTime && item.end?.dateTime) {
      const from = localParts(item.start.dateTime, timeZone);
      const to = localParts(item.end.dateTime, timeZone);

      for (const date of dates) {
        if (date < from.date || date > to.date) continue;
        const start = date === from.date ? from.minutes : 0;
        const end = date === to.date ? to.minutes : 1440;
        if (end <= start) continue;
        events.push({
          key: `${item.id}-${date}`,
          title,
          url,
          weekday: weekdayOf.get(date)!,
          allDay: false,
          from: start,
          length: end - start,
        });
      }
    } else if (item.start?.date) {
      const last = item.end?.date ?? shiftDate(item.start.date, 1);
      for (const date of dates) {
        if (date < item.start.date || date >= last) continue;
        events.push({
          key: `${item.id}-${date}`,
          title,
          url,
          weekday: weekdayOf.get(date)!,
          allDay: true,
          from: 0,
          length: 0,
        });
      }
    }
  }

  return {
    connected: result.connected,
    failed: result.failed,
    dates,
    events,
  };
}
