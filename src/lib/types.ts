import type { EntryKind, Frequency, Priority, TaskType } from "@/db/schema";

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
  emoji: string | null;
  color: string | null;
  activityId: string | null;
};

export type ActivityItem = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
};

export type TimeSectionEntry = {
  id: string;
  text: string;
};

export type TimeSectionItem = {
  id: string;
  title: string;
  collapsed: boolean;
  items: TimeSectionEntry[];
};

export type ActivityGroupItem = {
  id: string;
  kind: "investment" | "hobby";
  /** The main activity of an investment; null for hobbies. */
  activityId: string | null;
  name: string | null;
  emoji: string | null;
  members: { id: string; activityId: string }[];
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
  estimatedMinutes: number;
  type: TaskType;
  dueAt: string | null;
  myDayDate: string | null;
  completed: boolean;
  completedAt: string | null;
  steps: StepItem[];
};

export type RoutineItem = {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  important: boolean;
  estimatedMinutes: number;
  type: TaskType;
  frequency: Frequency;
  interval: number;
  byWeekday: number[] | null;
  byMonthDay: number | null;
  byLastWeekday: number | null;
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

/** A Google event placed on one ISO weekday of the current week. */
export type WeekEvent = {
  key: string;
  title: string;
  url: string | null;
  weekday: number;
  allDay: boolean;
  /** Minutes from local midnight; 0 for all-day events. */
  from: number;
  length: number;
};

export type CalendarWeek = {
  connected: boolean;
  failed: boolean;
  /** `YYYY-MM-DD` for Monday … Sunday of the current week. */
  dates: string[];
  events: WeekEvent[];
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

export const defaultMinutes = 15;

export const taskTypes: { value: TaskType; label: string }[] = [
  { value: "independent", label: "Independent" },
  { value: "dependent", label: "Dependent" },
  { value: "hybrid", label: "Hybrid" },
];

export const taskTypeLabels: Record<TaskType, string> = {
  independent: "Independent",
  dependent: "Dependent",
  hybrid: "Hybrid",
};

export const priorityLabels: Record<Priority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};
