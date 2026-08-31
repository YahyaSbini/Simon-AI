import type { Frequency, Priority } from "@/db/schema";

export type ListItem = {
  id: string;
  name: string;
};

export type StepItem = {
  id: string;
  title: string;
  completed: boolean;
};

export type TaskItem = {
  id: string;
  title: string;
  notes: string | null;
  listId: string | null;
  priority: Priority;
  estimatedMinutes: number | null;
  dueAt: string | null;
  myDayDate: string | null;
  completed: boolean;
  steps: StepItem[];
};

export type RoutineItem = {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  estimatedMinutes: number | null;
  frequency: Frequency;
  interval: number;
  byWeekday: number[] | null;
  byMonthDay: number | null;
  timeOfDay: string | null;
  startDate: string;
  active: boolean;
  recurrence: string;
};

export type RoutineOccurrence = RoutineItem & {
  completed: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  /** ISO timestamp, or null for all-day events. */
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string | null;
  url: string | null;
};

export type CalendarAgenda = {
  connected: boolean;
  /** Google was reachable but the request failed. */
  failed: boolean;
  events: CalendarEvent[];
};

export type CalendarStatus = {
  /** Whether Google OAuth credentials are set on the server. */
  configured: boolean;
  connected: boolean;
  hasCalendarAccess: boolean;
};

export const priorities: { value: Priority; label: string }[] = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const priorityLabels: Record<Priority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};
