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
