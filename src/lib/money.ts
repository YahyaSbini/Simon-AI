/** Money and month helpers shared by server and client. Amounts are integer cents. */

export const currency = "AED";

export const maxCents = 1_000_000_000;

export function formatMoney(
  cents: number,
  options: { sign?: boolean } = {},
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    signDisplay: options.sign ? "exceptZero" : "auto",
  }).format(cents / 100);
}

/** Parse "12", "12.5" or "1,234.50" into cents; null when not a positive amount. */
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 && cents <= maxCents ? cents : null;
}

export function toAmountInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Month keys are `YYYY-MM`. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function isMonthKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return year >= 1900 && year <= 2999 && month >= 1 && month <= 12;
}

export function addMonths(month: string, count: number): string {
  const [year, index] = month.split("-").map(Number);
  const total = year * 12 + (index - 1) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index, 0)).getUTCDate();
}

export function monthBounds(month: string): { start: string; end: string } {
  return {
    start: `${month}-01`,
    end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
  };
}

/** Due date of a monthly item, moved to the last day in shorter months. */
export function dueDateIn(month: string, dueDay: number): string {
  const day = Math.min(dueDay, daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function formatMonth(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", timeZone: "UTC" },
  );
}

export function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
  return `${day}${suffix}`;
}

/** Whole months from `from` to `to` (both `YYYY-MM`), never below zero. */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return Math.max(0, (toYear - fromYear) * 12 + (toMonth - fromMonth));
}

/** Amount to put aside each month, counting the current one, to reach a goal on time. */
export function monthlyPace(
  goal: { targetCents: number; savedCents: number; targetDate: string | null },
  today: string,
): number | null {
  if (!goal.targetDate || goal.savedCents >= goal.targetCents) return null;
  if (goal.targetDate < today) return null;
  const months = monthsBetween(monthOf(today), monthOf(goal.targetDate)) + 1;
  return Math.ceil((goal.targetCents - goal.savedCents) / months);
}
