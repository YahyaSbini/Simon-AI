import type { EntryKind, Frequency, Priority } from "@/db/schema";

export type ListItem = {
  id: string;
  name: string;
};

export type DayBlockItem = {
  id: string;
  weekdays: number[];
  start: string;
  end: string;
  label: string;
  color: string | null;
};

export type CategoryItem = {
  id: string;
  kind: EntryKind;
  name: string;
};

export type EntryItem = {
  id: string;
  kind: EntryKind;
  amountCents: number;
  categoryId: string | null;
  budgetItemId: string | null;
  date: string;
  note: string | null;
  expected: boolean;
};

export type BudgetItemRow = {
  id: string;
  name: string;
  categoryId: string | null;
  amountCents: number;
  dueDay: number | null;
  startDate: string;
};

export type SavingsGoalItem = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  targetDate: string | null;
};

export type StepItem = {
  id: string;
  title: string;
  notes: string | null;
  completed: boolean;
};

export type TaskItem = {
  id: string;
  title: string;
  notes: string | null;
  listId: string | null;
  priority: Priority;
  important: boolean;
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
  important: boolean;
  estimatedMinutes: number | null;
  frequency: Frequency;
  interval: number;
  byWeekday: number[] | null;
  byMonthDay: number | null;
  timeOfDay: string | null;
  startDate: string;
  endDate: string | null;
  carryOver: boolean;
  active: boolean;
  recurrence: string;
  steps: StepItem[];
};

export type RoutineOccurrence = RoutineItem & {
  /** Day this occurrence belongs to; earlier than today for carried-over misses. */
  date: string;
  /** `${id}:${date}` — unique per row, since a routine can appear for several days. */
  key: string;
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
