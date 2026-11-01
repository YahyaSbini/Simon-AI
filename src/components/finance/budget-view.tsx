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

type Kind = BudgetItemRow["kind"];
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

const emptyDraft: Draft = {
  type: "bill",
  name: "",
  amount: "",
  categoryId: "",
  dueDay: "1",
};

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
  const [adding, setAdding] = useState<Kind | null>(null);
  const [saving, setSaving] = useState(false);
  const categoryName = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );
  const lines = budgetLines(items, entries, month);
  const settled = entries.filter((entry) => !entry.expected);
  const money = (cents: number) => formatMoney(cents);

  const columns = (["income", "expense"] as const).map((kind) => {
    const mine = lines.filter((line) => line.item.kind === kind);
    return {
      kind,
      label: kind === "income" ? "Income" : "Outcome",
      lines: mine,
      categories: categories.filter((item) => item.kind === kind),
      planned: mine.reduce((sum, line) => sum + line.item.amountCents, 0),
      actual: settled
        .filter((entry) => entry.kind === kind)
        .reduce((sum, entry) => sum + entry.amountCents, 0),
    };
  });

  function toPayload(kind: Kind, draft: Draft) {
    const name = draft.name.trim();
    const amountCents = parseAmount(draft.amount);
    const dueDay = Number(draft.dueDay);
    const bill = kind === "expense" && draft.type === "bill";
    if (!name) {
      toast.error("Give the item a name.");
      return null;
    }
    if (!amountCents) {
      toast.error("Enter an amount above zero.");
      return null;
    }
    if (bill && !(dueDay >= 1 && dueDay <= 31)) {
      toast.error("Pick the day of the month it's paid, 1 to 31.");
      return null;
    }
    if (!bill && !draft.categoryId) {
      toast.error(
        kind === "income"
          ? "Income is counted by category. Pick one."
          : "A limit tracks a category. Pick one.",
      );
      return null;
    }
    return {
      name,
      amountCents,
      categoryId: draft.categoryId || null,
      dueDay: bill ? dueDay : null,
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

  async function createItem(kind: Kind, draft: Draft) {
    const payload = toPayload(kind, draft);
    if (!payload) return false;
    setSaving(true);
    const result = await sendJson<Saved>("/api/finance/budget-items", "POST", {
      ...payload,
      kind,
    });
    setSaving(false);
    if (!result) {
      toast.error("Couldn't add that budget item.");
      return false;
    }
    setItems((current) => [...current, result.item]);
    mergePosted(result.posted);
    if (result.posted.length) {
      toast.success(`${result.item.name} posted as today's outcome.`);
    }
    return true;
  }

  async function updateItem(item: BudgetItemRow, draft: Draft) {
    const payload = toPayload(item.kind, draft);
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
    if (item.kind === "income") return "received";
    if (!item.dueDay) return "spent";
    if (line.paid) return "paid";
    if (!line.dueDate) {
      return `starts ${formatShortDate(dueDateIn(addMonths(month, 1), item.dueDay))}`;
    }
    if (line.dueDate >= today) return `due ${formatShortDate(line.dueDate)}`;
    return "not posted";
  }

  function remainder(line: BudgetLine) {
    const { item, spentCents } = line;
    const diff = item.amountCents - spentCents;
    if (item.kind === "income") {
      return diff >= 0
        ? { text: `${money(diff)} to receive`, over: false }
        : { text: `${money(-diff)} above plan`, over: false };
    }
    if (item.dueDay) return null;
    return diff >= 0
      ? { text: `${money(diff)} left`, over: false }
      : { text: `${money(-diff)} over`, over: true };
  }

  function renderBox(line: BudgetLine, kindCategories: CategoryItem[]) {
    const { item } = line;
    if (editingId === item.id) {
      return (
        <li
          key={item.id}
          className="border-border bg-card rounded-xl border p-3 sm:col-span-2"
        >
          <ItemForm
            kind={item.kind}
            initial={{
              type: item.dueDay ? "bill" : "limit",
              name: item.name,
              amount: toAmountInput(item.amountCents),
              categoryId: item.categoryId ?? "",
              dueDay: item.dueDay ? String(item.dueDay) : "",
            }}
            categories={kindCategories}
            onSubmit={(draft) => updateItem(item, draft)}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }

    const rest = remainder(line);
    const showActual = !item.dueDay || line.paid;
    const detail = [
      item.categoryId ? categoryName.get(item.categoryId) : null,
      item.dueDay ? `Posts on the ${ordinal(item.dueDay)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <li
        key={item.id}
        className={cn(
          "group/row border-border bg-card flex flex-col gap-3 rounded-xl border p-4 transition-colors",
          rest?.over && "border-destructive/50",
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            {detail ? (
              <p className="text-muted-foreground truncate text-sm">{detail}</p>
            ) : null}
          </div>
          <span className="-mt-1 -mr-2 flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
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
        <div className="mt-auto space-y-2">
          <p className="text-sm tabular-nums">
            <span
              className={cn(
                "font-heading text-xl",
                rest?.over && "text-destructive",
              )}
            >
              {money(showActual ? line.spentCents : item.amountCents)}
            </span>{" "}
            <span className="text-muted-foreground">
              {showActual
                ? `${status(line)} of ${money(item.amountCents)}`
                : status(line)}
            </span>
          </p>
          {!item.dueDay ? (
            <Meter
              value={line.spentCents}
              max={item.amountCents}
              label={`${item.name} ${status(line)}`}
            />
          ) : null}
          {rest ? (
            <p
              className={cn(
                "text-sm tabular-nums",
                rest.over
                  ? "text-destructive font-medium"
                  : "text-muted-foreground",
              )}
            >
              {rest.text}
            </p>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-8 lg:grid-cols-2">
        {columns.map((column) => (
          <section key={column.kind} className="min-w-0 space-y-3">
            <div className="space-y-2">
              <h2 className="text-muted-foreground flex items-baseline justify-between gap-3 text-xs tracking-wide uppercase">
                {column.label}
                <span className="tabular-nums normal-case">
                  {money(column.actual)} of {money(column.planned)}
                </span>
              </h2>
              <Meter
                value={column.actual}
                max={column.planned}
                label={`${column.label} against budget`}
              />
            </div>

            {column.lines.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {column.lines.map((line) => renderBox(line, column.categories))}
              </ul>
            ) : (
              <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                {column.kind === "income"
                  ? "Plan what you expect to receive, like Salary. Income in that category counts toward it."
                  : "Bills post themselves on their day. Limits cap a category, like Groceries."}
              </p>
            )}

            {adding === column.kind ? (
              <div className="border-border bg-card rounded-xl border p-3">
                <ItemForm
                  kind={column.kind}
                  initial={emptyDraft}
                  categories={column.categories}
                  saving={saving}
                  onSubmit={(draft) => createItem(column.kind, draft)}
                  onCancel={() => setAdding(null)}
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setAdding(column.kind)}
              >
                <Plus data-icon="inline-start" />
                Add {column.label.toLowerCase()}
              </Button>
            )}
          </section>
        ))}
      </div>
      {month !== monthOf(today) ? (
        <p className="text-muted-foreground text-sm">
          New items start from today, not from {formatMonth(month)}.
        </p>
      ) : null}
    </div>
  );
}

function ItemForm({
  kind,
  initial,
  categories,
  saving = false,
  onSubmit,
  onCancel,
}: {
  kind: Kind;
  initial: Draft;
  categories: CategoryItem[];
  saving?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const editing = Boolean(initial.name);
  const bill = kind === "expense" && draft.type === "bill";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) setDraft({ ...draft, name: "", amount: "" });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      {kind === "expense" ? (
        <Segmented
          label="Item type"
          value={draft.type}
          options={typeOptions}
          onChange={(type) => setDraft({ ...draft, type })}
        />
      ) : null}
      <Input
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        placeholder={
          kind === "income"
            ? "e.g. Salary"
            : bill
              ? "e.g. Rent, Netflix"
              : "e.g. Food"
        }
        aria-label="Name"
        maxLength={80}
        autoFocus
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
        <option value="">{bill ? "No category" : "Pick category"}</option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {bill ? (
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <X />
        </Button>
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
              {kind === "income"
                ? "Add income"
                : bill
                  ? "Add bill"
                  : "Add limit"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
