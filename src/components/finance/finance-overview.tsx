"use client";

import {
  ArrowRight,
  Check,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Meter, Segmented, sendJson } from "@/components/finance/finance-bits";
import { selectClass } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthTotals } from "@/lib/budget";
import {
  formatMoney,
  formatMonth,
  formatShortDate,
  monthOf,
  parseAmount,
  toAmountInput,
} from "@/lib/money";
import type { BudgetItemRow, CategoryItem, EntryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = EntryItem["kind"];

type Draft = {
  kind: Kind;
  amount: string;
  categoryId: string;
  date: string;
  note: string;
};

const kindOptions: { value: Kind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export function FinanceOverview({
  month,
  today,
  currency,
  categories,
  budget,
  initialEntries,
}: {
  month: string;
  today: string;
  currency: string;
  categories: CategoryItem[];
  budget: BudgetItemRow[];
  initialEntries: EntryItem[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const totals = monthTotals(budget, entries, month);
  const left = totals.incomeCents - totals.spentCents;
  const money = (cents: number, sign = false) =>
    formatMoney(cents, currency, { sign });
  const categoryName = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  const days = useMemo(() => {
    const groups = new Map<string, EntryItem[]>();
    for (const entry of [...entries].sort((a, b) =>
      b.date.localeCompare(a.date),
    )) {
      groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [entries]);

  function toPayload(draft: Draft) {
    const amountCents = parseAmount(draft.amount);
    if (!amountCents) {
      toast.error("Enter an amount above zero.");
      return null;
    }
    if (!draft.date) {
      toast.error("Pick a date.");
      return null;
    }
    return {
      kind: draft.kind,
      amountCents,
      categoryId: draft.categoryId || null,
      date: draft.date,
      note: draft.note.trim() || null,
    };
  }

  async function createEntry(draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    setSaving(true);
    const result = await sendJson<{ entry: EntryItem }>(
      "/api/finance/entries",
      "POST",
      payload,
    );
    setSaving(false);
    if (!result) {
      toast.error(`Couldn't add that ${draft.kind}.`);
      return false;
    }
    if (monthOf(result.entry.date) === month) {
      setEntries((current) => [result.entry, ...current]);
    } else {
      toast.success(`Added to ${formatMonth(monthOf(result.entry.date))}.`);
    }
    return true;
  }

  async function updateEntry(entry: EntryItem, draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    const result = await sendJson<{ entry: EntryItem }>(
      `/api/finance/entries/${entry.id}`,
      "PATCH",
      payload,
    );
    if (!result) {
      toast.error("Couldn't save that entry.");
      return false;
    }
    setEntries((current) =>
      monthOf(result.entry.date) === month
        ? current.map((item) => (item.id === entry.id ? result.entry : item))
        : current.filter((item) => item.id !== entry.id),
    );
    setEditingId(null);
    return true;
  }

  async function removeEntry(entry: EntryItem) {
    const previous = entries;
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    const result = await sendJson(`/api/finance/entries/${entry.id}`, "DELETE");
    if (!result) {
      toast.error("Couldn't remove that entry.");
      setEntries(previous);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <dl className="border-border bg-card grid grid-cols-3 divide-x divide-border rounded-xl border">
          <Figure label="Income" value={money(totals.incomeCents)} />
          <Figure label="Spent" value={money(totals.spentCents)} />
          <Figure
            label="Left"
            value={money(left)}
            className={cn(left < 0 && "text-destructive")}
          />
        </dl>

        {totals.budgetedCents > 0 ? (
          <Link
            href={
              month === monthOf(today)
                ? "/finance/budget"
                : `/finance/budget?month=${month}`
            }
            className="group focus-visible:ring-ring -mx-2 block space-y-2 rounded-lg px-2 py-2 outline-none hover:bg-muted/50 focus-visible:ring-2"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium tabular-nums">
                  {money(totals.spentCents)}
                </span>{" "}
                of {money(totals.budgetedCents)} budget
              </span>
              <span className="text-azure flex items-center gap-1 text-sm font-medium">
                Budget
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <Meter
              value={totals.spentCents}
              max={totals.budgetedCents}
              label="Spent against budget"
            />
          </Link>
        ) : null}
      </section>

      <section className="space-y-4">
        <EntryForm
          initial={{
            kind: "expense",
            amount: "",
            categoryId: "",
            date: month === monthOf(today) ? today : `${month}-01`,
            note: "",
          }}
          categories={categories}
          saving={saving}
          onSubmit={createEntry}
        />

        {days.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            Nothing logged for {formatMonth(month)}. Add an income or expense
            above.
          </p>
        ) : (
          <div className="space-y-6">
            {days.map(([date, items]) => (
              <div key={date}>
                <h2 className="text-muted-foreground border-border mb-1 border-b pb-2 text-xs tracking-wide uppercase">
                  {date === today ? "Today" : formatShortDate(date)}
                </h2>
                <ul>
                  {items.map((entry) =>
                    editingId === entry.id ? (
                      <li key={entry.id} className="py-1">
                        <EntryForm
                          initial={{
                            kind: entry.kind,
                            amount: toAmountInput(entry.amountCents),
                            categoryId: entry.categoryId ?? "",
                            date: entry.date,
                            note: entry.note ?? "",
                          }}
                          categories={categories}
                          onSubmit={(draft) => updateEntry(entry, draft)}
                          onCancel={() => setEditingId(null)}
                        />
                      </li>
                    ) : (
                      <li
                        key={entry.id}
                        className="group/row flex min-h-11 items-center gap-3 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm">
                            {entry.categoryId
                              ? (categoryName.get(entry.categoryId) ??
                                "Uncategorized")
                              : "Uncategorized"}
                            {entry.budgetItemId ? (
                              <Repeat
                                className="text-muted-foreground size-3.5 shrink-0"
                                aria-label="Posted by a budget bill"
                              />
                            ) : null}
                          </p>
                          {entry.note ? (
                            <p className="text-muted-foreground truncate text-sm">
                              {entry.note}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm tabular-nums",
                            entry.kind === "income" && "font-medium",
                          )}
                        >
                          {money(
                            entry.kind === "income"
                              ? entry.amountCents
                              : -entry.amountCents,
                            true,
                          )}
                        </span>
                        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit entry"
                            onClick={() => setEditingId(entry.id)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="hover:text-destructive"
                            aria-label="Remove entry"
                            onClick={() => removeEntry(entry)}
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-4 sm:py-4">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "font-heading mt-1 truncate text-lg tabular-nums sm:text-2xl",
          className,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EntryForm({
  initial,
  categories,
  saving = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  categories: CategoryItem[];
  saving?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const editing = Boolean(onCancel);
  const options = categories.filter((item) => item.kind === draft.kind);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) {
      setDraft({ ...draft, amount: "", note: "" });
    }
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md",
        editing && "bg-muted/50 -mx-2 px-2 py-2",
      )}
    >
      <Segmented
        label="Type"
        value={draft.kind}
        options={kindOptions}
        onChange={(kind) => {
          const keep = categories.some(
            (item) => item.id === draft.categoryId && item.kind === kind,
          );
          setDraft({
            ...draft,
            kind,
            categoryId: keep ? draft.categoryId : "",
          });
        }}
      />
      <Input
        value={draft.amount}
        onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
        inputMode="decimal"
        placeholder="0.00"
        aria-label="Amount"
        autoFocus={editing}
        className="w-28 tabular-nums"
      />
      <select
        value={draft.categoryId}
        onChange={(event) =>
          setDraft({ ...draft, categoryId: event.target.value })
        }
        aria-label="Category"
        className={cn(selectClass, "w-36")}
      >
        <option value="">No category</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <Input
        type="date"
        value={draft.date}
        onChange={(event) => setDraft({ ...draft, date: event.target.value })}
        aria-label="Date"
        required
        className="w-36 tabular-nums"
      />
      <Input
        value={draft.note}
        onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        placeholder="Note"
        aria-label="Note"
        maxLength={200}
        className="min-w-32 flex-1"
      />
      <div className="flex items-center gap-1">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel"
            onClick={onCancel}
          >
            <X />
          </Button>
        ) : null}
        <Button
          type="submit"
          size={editing ? "icon" : "default"}
          disabled={saving}
          aria-label={editing ? "Save" : undefined}
        >
          {editing ? (
            <Check />
          ) : (
            <>
              <Plus data-icon="inline-start" />
              {draft.kind === "income" ? "Add income" : "Add expense"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
