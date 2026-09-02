import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { account } from "@/db/schema";
import { auth, calendarScope, googleConfigured } from "@/lib/auth";
import { dayRangeIn } from "@/lib/timezone";
import type {
  CalendarAgenda,
  CalendarEvent,
  CalendarStatus,
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

/** Events from the user's primary Google calendar for a single local day. */
export async function getCalendarAgenda(
  userId: string,
  date: string,
  timeZone: string,
): Promise<CalendarAgenda> {
  if (!googleConfigured) {
    return { connected: false, failed: false, events: [] };
  }

  const row = await findGoogleAccount(userId);

  if (!row || !row.scope?.includes(calendarScope)) {
    return { connected: false, failed: false, events: [] };
  }

  let accessToken: string;

  try {
    const token = await auth.api.getAccessToken({
      body: { accountId: row.id, userId },
      headers: await headers(),
    });
    accessToken = token.accessToken;
  } catch {
    return { connected: true, failed: true, events: [] };
  }

  const { start, end } = dayRangeIn(date, timeZone);

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("timeZone", timeZone);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return { connected: true, failed: true, events: [] };
  }

  const payload = (await response.json()) as { items?: GoogleEvent[] };

  const events: CalendarEvent[] = (payload.items ?? [])
    .filter((item) => item.status !== "cancelled")
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
