import type { EntryItem } from "@/lib/types";

export type MonthTotals = {
  incomeCents: number;
  spentCents: number;
  /** Expected entries, kept apart from the received and paid figures. */
  expectedIncomeCents: number;
  expectedSpendCents: number;
};

export function monthTotals(entries: EntryItem[]): MonthTotals {
  let incomeCents = 0;
  let spentCents = 0;
  let expectedIncomeCents = 0;
  let expectedSpendCents = 0;
  for (const entry of entries) {
    if (entry.expected) {
      if (entry.kind === "income") expectedIncomeCents += entry.amountCents;
      else expectedSpendCents += entry.amountCents;
    } else if (entry.kind === "income") incomeCents += entry.amountCents;
    else spentCents += entry.amountCents;
  }
  return { incomeCents, spentCents, expectedIncomeCents, expectedSpendCents };
}
