import { z } from "zod";

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 1900 && year <= 2999;
  });

export const timestamp = z.coerce
  .date()
  .refine((value) => value.getFullYear() >= 1900 && value.getFullYear() <= 2999);

export const routineInput = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).nullish(),
  priority: z.enum(["none", "low", "medium", "high"]).optional(),
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
  active: z.boolean().optional(),
});
