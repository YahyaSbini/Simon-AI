"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Meter, Segmented, sendJson } from "@/components/finance/finance-bits";
import { selectClass } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type BudgetLine, budgetLines } from "@/lib/budget";
import {
  addMonths,
  dueDateIn,
  formatMoney,
  formatMonth,
  formatShortDate,
  monthOf,
  ordinal,
  parseAmount,
  toAmountInput,
} from "@/lib/money";
import type { BudgetItemRow, CategoryItem, EntryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type ItemType = "bill" | "limit";

type Draft = {
  type: ItemType;
  name: string;
  amount: string;
  categoryId: string;
  dueDay: string;
};

const typeOptions: { value: ItemType; label: string }[] = [
  { value: "bill", label: "Bill" },
  { value: "limit", label: "Limit" },
];

type Saved = { item: BudgetItemRow; posted: EntryItem[] };

export function BudgetView({
  month,
  today,
  categories,
  initialItems,
  initialEntries,
}: {
  month: string;
  today: string;
  categories: CategoryItem[];
  initialItems: BudgetItemRow[];
  initialEntries: EntryItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [entries, setEntries] = useState(initialEntries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const expenseCategories = categories.filter(
    (item) => item.kind === "expense",
  );
  const categoryName = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );
  const lines = budgetLines(items, entries, month);
  const bills = lines.filter((line) => line.item.dueDay);
  const limits = lines.filter((line) => !line.item.dueDay);
  const budgeted = lines.reduce((sum, line) => sum + line.item.amountCents, 0);
  const spent = entries
    .filter((entry) => entry.kind === "expense")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const money = (cents: number) => formatMoney(cents);

  function toPayload(draft: Draft) {
    const name = draft.name.trim();
    const amountCents = parseAmount(draft.amount);
    const dueDay = Number(draft.dueDay);
    if (!name) {
      toast.error("Give the item a name.");
      return null;
    }
    if (!amountCents) {
      toast.error("Enter an amount above zero.");
      return null;
    }
    if (draft.type === "bill" && !(dueDay >= 1 && dueDay <= 31)) {
      toast.error("Pick the day of the month it's paid, 1 to 31.");
      return null;
    }
    if (draft.type === "limit" && !draft.categoryId) {
      toast.error("A limit tracks a category. Pick one.");
      return null;
    }
    return {
      name,
      amountCents,
      categoryId: draft.categoryId || null,
      dueDay: draft.type === "bill" ? dueDay : null,
    };
  }

  function mergePosted(posted: EntryItem[]) {
    const mine = posted.filter((entry) => monthOf(entry.date) === month);
    if (!mine.length) return;
    setEntries((current) => [
      ...current.filter((entry) => !mine.some((item) => item.id === entry.id)),
      ...mine,
    ]);
  }

  async function createItem(draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    setSaving(true);
    const result = await sendJson<Saved>(
      "/api/finance/budget-items",
      "POST",
      payload,
    );
    setSaving(false);
    if (!result) {
      toast.error("Couldn't add that budget item.");
      return false;
    }
    setItems((current) => [...current, result.item]);
    mergePosted(result.posted);
    if (result.posted.length) {
      toast.success(`${result.item.name} posted as today's expense.`);
    }
    return true;
  }

  async function updateItem(item: BudgetItemRow, draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    const result = await sendJson<Saved>(
      `/api/finance/budget-items/${item.id}`,
      "PATCH",
      payload,
    );
    if (!result) {
      toast.error("Couldn't save that budget item.");
      return false;
    }
    setItems((current) =>
      current.map((row) => (row.id === item.id ? result.item : row)),
    );
    mergePosted(result.posted);
    setEditingId(null);
    return true;
  }

  async function removeItem(item: BudgetItemRow) {
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== item.id));
    const result = await sendJson(
      `/api/finance/budget-items/${item.id}`,
      "DELETE",
    );
    if (!result) {
      toast.error("Couldn't remove that budget item.");
      setItems(previous);
    }
  }

  function status(line: BudgetLine): string {
    const { item } = line;
    if (!item.dueDay) {
      return `${money(line.spentCents)} of ${money(item.amountCents)}`;
    }
    if (line.paid) return `Paid ${money(line.spentCents)}`;
    if (!line.dueDate) {
      return `Starts ${formatShortDate(dueDateIn(addMonths(month, 1), item.dueDay))}`;
    }
    if (line.dueDate >= today) return `Due ${formatShortDate(line.dueDate)}`;
    return "Not posted";
  }

  function renderLine(line: BudgetLine) {
    const { item } = line;
    if (editingId === item.id) {
      return (
        <li key={item.id} className="py-1">
          <ItemForm
            initial={{
              type: item.dueDay ? "bill" : "limit",
              name: item.name,
              amount: toAmountInput(item.amountCents),
              categoryId: item.categoryId ?? "",
              dueDay: item.dueDay ? String(item.dueDay) : "",
            }}
            categories={expenseCategories}
            onSubmit={(draft) => updateItem(item, draft)}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }

    const over = !item.dueDay && line.spentCents > item.amountCents;
    const detail = [
      item.categoryId ? categoryName.get(item.categoryId) : null,
      item.dueDay ? `Posts on the ${ordinal(item.dueDay)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <li key={item.id} className="group/row space-y-2 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            {detail ? (
              <p className="text-muted-foreground truncate text-sm">{detail}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right text-sm tabular-nums">
            <p className={cn(over && "text-destructive")}>{status(line)}</p>
            {item.dueDay ? (
              <p className="text-muted-foreground">{money(item.amountCents)}</p>
            ) : over ? (
              <p className="text-destructive">
                {money(line.spentCents - item.amountCents)} over
              </p>
            ) : (
              <p className="text-muted-foreground">
                {money(item.amountCents - line.spentCents)} left
              </p>
            )}
          </div>
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${item.name}`}
              onClick={() => setEditingId(item.id)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hover:text-destructive"
              aria-label={`Remove ${item.name}`}
              onClick={() => removeItem(item)}
            >
              <Trash2 />
            </Button>
          </span>
        </div>
        {!item.dueDay ? (
          <Meter
            value={line.spentCents}
            max={item.amountCents}
            label={`${item.name} spent`}
          />
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm">
          <span className="font-heading text-2xl tabular-nums">
            {money(spent)}
          </span>{" "}
          <span className="text-muted-foreground">
            spent of {money(budgeted)} planned
          </span>
        </p>
        <Meter value={spent} max={budgeted} label="Spent against budget" />
      </section>

      <BudgetGroup
        title="Bills"
        empty="Rent, subscriptions and other fixed costs. Each one posts itself as an expense on its day."
      >
        {bills.map(renderLine)}
      </BudgetGroup>

      <BudgetGroup
        title="Limits"
        empty="A monthly cap for a category, like Groceries. Expenses in that category count toward it."
      >
        {limits.map(renderLine)}
      </BudgetGroup>

      <ItemForm
        initial={{
          type: "bill",
          name: "",
          amount: "",
          categoryId: "",
          dueDay: "1",
        }}
        categories={expenseCategories}
        saving={saving}
        onSubmit={createItem}
      />
      {month !== monthOf(today) ? (
        <p className="text-muted-foreground text-sm">
          New items start from today, not from {formatMonth(month)}.
        </p>
      ) : null}
    </div>
  );
}

function BudgetGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="text-muted-foreground border-border border-b pb-2 text-xs tracking-wide uppercase">
        {title}
      </h2>
      {children.length ? (
        <ul className="divide-border divide-y">{children}</ul>
      ) : (
        <p className="text-muted-foreground py-3 text-sm">{empty}</p>
      )}
    </section>
  );
}

function ItemForm({
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) setDraft({ ...draft, name: "", amount: "" });
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
        label="Item type"
        value={draft.type}
        options={typeOptions}
        onChange={(type) => setDraft({ ...draft, type })}
      />
      <Input
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        placeholder={draft.type === "bill" ? "e.g. Rent, Netflix" : "e.g. Food"}
        aria-label="Name"
        maxLength={80}
        autoFocus={editing}
        className="min-w-36 flex-1"
      />
      <Input
        value={draft.amount}
        onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
        inputMode="decimal"
        placeholder="0.00"
        aria-label="Monthly amount"
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
        <option value="">
          {draft.type === "limit" ? "Pick category" : "No category"}
        </option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {draft.type === "bill" ? (
        <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
          Day
          <Input
            type="number"
            min={1}
            max={31}
            value={draft.dueDay}
            onChange={(event) =>
              setDraft({ ...draft, dueDay: event.target.value })
            }
            aria-label="Day of month"
            className="w-16 tabular-nums"
          />
        </label>
      ) : null}
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
              {draft.type === "bill" ? "Add bill" : "Add limit"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
