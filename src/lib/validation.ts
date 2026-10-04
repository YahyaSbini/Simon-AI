import { z } from "zod";
import { maxCents } from "@/lib/money";

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 1900 && year <= 2999;
  });

export const timestamp = z.coerce
  .date()
  .refine(
    (value) => value.getFullYear() >= 1900 && value.getFullYear() <= 2999,
  );

export const routineInput = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).nullish(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
  important: z.boolean().optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullish(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(365).default(1),
  byWeekday: z.array(z.number().int().min(1).max(7)).nullish(),
  byMonthDay: z.number().int().min(1).max(31).nullish(),
  timeOfDay: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish(),
  startDate: dateKey.optional(),
  endDate: dateKey.nullish(),
  carryOver: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** Inclusive range check shared by create and (merged) update. */
export const calendarCompletionInput = z.object({
  eventId: z.string().min(1).max(1024),
  date: dateKey,
});

export function validDateRange(range: {
  startDate: string;
  endDate?: string | null;
}): boolean {
  return !range.endDate || range.endDate >= range.startDate;
}

export const dayBlockColors = [
  "azure",
  "wood",
  "sage",
  "clay",
  "slate",
] as const;

export const dayBlockInput = z.object({
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().trim().min(1).max(80),
  color: z.enum(dayBlockColors).nullish(),
});

export const reorderInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

const cents = z.number().int().min(1).max(maxCents);
const entryKind = z.enum(["income", "expense"]);

export const entryInput = z.object({
  kind: entryKind,
  amountCents: cents,
  categoryId: z.string().uuid().nullish(),
  date: dateKey,
  note: z.string().trim().max(200).nullish(),
  expected: z.boolean().optional(),
});

export const categoryInput = z.object({
  kind: entryKind,
  name: z.string().trim().min(1).max(40),
});

export const budgetItemInput = z.object({
  name: z.string().trim().min(1).max(80),
  amountCents: cents,
  categoryId: z.string().uuid().nullish(),
  dueDay: z.number().int().min(1).max(31).nullish(),
});

export const savingsGoalInput = z.object({
  name: z.string().trim().min(1).max(80),
  targetCents: cents,
  savedCents: z.number().int().min(0).max(maxCents).optional(),
  targetDate: dateKey.nullish(),
});
