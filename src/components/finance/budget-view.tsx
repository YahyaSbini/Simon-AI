"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CollapseBody,
  CollapseToggle,
  useClosedSections,
} from "@/components/collapsible";
import { Meter, Segmented, sendJson } from "@/components/finance/finance-bits";
import { selectClass } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { type BudgetLine, budgetLines } from "@/lib/budget";
import {
  addMonths,
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
  notes: string;
  repeats: boolean;
};

/** Where a change goes: one month, or the default list. */
type Scope = "month" | "default";

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
  notes: "",
  repeats: false,
};

type Snapshot = {
  budget: BudgetItemRow[];
  defaults: BudgetItemRow[];
  entries: EntryItem[];
};

function draftOf(item: BudgetItemRow): Draft {
  return {
    type: item.dueDay ? "bill" : "limit",
    name: item.name,
    amount: toAmountInput(item.amountCents),
    categoryId: item.categoryId ?? "",
    dueDay: item.dueDay ? String(item.dueDay) : "",
    notes: item.notes ?? "",
    repeats: item.repeats,
  };
}

export function BudgetView({
  month,
  today,
  categories,
  initialItems,
  initialDefaults,
  initialEntries,
}: {
  month: string;
  today: string;
  categories: CategoryItem[];
  initialItems: BudgetItemRow[];
  initialDefaults: BudgetItemRow[];
  initialEntries: EntryItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [defaults, setDefaults] = useState(initialDefaults);
  const [entries, setEntries] = useState(initialEntries);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { closed, setOpen } = useClosedSections("finance-budget-closed");
  const defaultsOpen = !closed.has("defaults");
  const current = monthOf(today);
  const next = addMonths(current, 1);
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
    .filter((entry) => entry.kind === "expense" && !entry.expected)
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
      notes: draft.notes.trim() || null,
    };
  }

  function apply(snapshot: Snapshot) {
    const known = new Set(entries.map((entry) => entry.id));
    const posted = snapshot.entries.filter(
      (entry) => entry.budgetItemId && !known.has(entry.id),
    );
    setItems(snapshot.budget);
    setDefaults(snapshot.defaults);
    setEntries(snapshot.entries);
    for (const entry of posted) {
      toast.success(
        `${entry.note ?? "Bill"} posted as an expense on ${formatShortDate(entry.date)}.`,
      );
    }
  }

  async function createItem(draft: Draft, scope: Scope) {
    const payload = toPayload(draft);
    if (!payload) return false;
    setSaving(true);
    const result = await sendJson<Snapshot>(
      "/api/finance/budget-items",
      "POST",
      {
        ...payload,
        view: month,
        ...(scope === "month" ? { month, repeats: draft.repeats } : {}),
      },
    );
    setSaving(false);
    if (!result) {
      toast.error("Couldn't add that budget item.");
      return false;
    }
    apply(result);
    return true;
  }

  async function updateItem(item: BudgetItemRow, draft: Draft, scope: Scope) {
    const payload = toPayload(draft);
    if (!payload) return false;
    const result = await sendJson<Snapshot>(
      `/api/finance/budget-items/${item.id}`,
      "PATCH",
      {
        ...payload,
        view: month,
        ...(scope === "month" ? { month, repeats: draft.repeats } : {}),
      },
    );
    if (!result) {
      toast.error("Couldn't save that budget item.");
      return false;
    }
    apply(result);
    setEditing(null);
    return true;
  }

  async function removeItem(item: BudgetItemRow, scope: Scope) {
    const query = new URLSearchParams({ view: month });
    if (scope === "month") query.set("month", month);
    const result = await sendJson<Snapshot>(
      `/api/finance/budget-items/${item.id}?${query}`,
      "DELETE",
    );
    if (!result) {
      toast.error("Couldn't remove that budget item.");
      return;
    }
    apply(result);
    if (scope === "default" && monthOf(item.startDate) <= current) {
      toast.success(
        `${item.name} stops from ${formatMonth(next)}. ${formatMonth(current)} and earlier keep it.`,
      );
    }
  }

  function status(line: BudgetLine): string {
    const { item } = line;
    if (!item.dueDay) {
      return `${money(line.spentCents)} of ${money(item.amountCents)}`;
    }
    if (line.paid) return `Paid ${money(line.spentCents)}`;
    if (line.dueDate && line.dueDate >= today) {
      return `Due ${formatShortDate(line.dueDate)}`;
    }
    return "Not posted";
  }

  function details(item: BudgetItemRow, extra: (string | null)[] = []) {
    return [
      item.categoryId ? categoryName.get(item.categoryId) : null,
      item.dueDay ? `Posts on the ${ordinal(item.dueDay)}` : null,
      ...extra,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function actions(item: BudgetItemRow, key: string, scope: Scope) {
    return (
      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${item.name}`}
          onClick={() => setEditing(key)}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hover:text-destructive"
          aria-label={`Remove ${item.name}`}
          onClick={() => removeItem(item, scope)}
        >
          <Trash2 />
        </Button>
      </span>
    );
  }

  function title(item: BudgetItemRow, detail: string) {
    return (
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        {detail ? (
          <p className="text-muted-foreground truncate text-sm">{detail}</p>
        ) : null}
        {item.notes ? (
          <p className="text-muted-foreground text-sm break-words whitespace-pre-line">
            {item.notes}
          </p>
        ) : null}
      </div>
    );
  }

  function renderDefault(item: BudgetItemRow) {
    const key = `default:${item.id}`;
    const first = monthOf(item.startDate);
    if (editing === key) {
      return (
        <li key={item.id} className="py-1">
          <ItemForm
            initial={draftOf(item)}
            categories={expenseCategories}
            hint={() =>
              first > current
                ? null
                : `Applies from ${formatMonth(next)}. ${formatMonth(current)} and earlier stay as they are.`
            }
            onSubmit={(draft) => updateItem(item, draft, "default")}
            onCancel={() => setEditing(null)}
          />
        </li>
      );
    }
    const detail = details(item, [
      first > current ? `From ${formatMonth(first)}` : null,
      item.endMonth ? `Until ${formatMonth(item.endMonth)}` : null,
    ]);
    return (
      <li key={item.id} className="group/row flex items-center gap-3 py-3">
        {title(item, detail)}
        <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {money(item.amountCents)}
        </p>
        {actions(item, key, "default")}
      </li>
    );
  }

  function renderLine(line: BudgetLine) {
    const { item } = line;
    const key = `month:${item.id}`;
    if (editing === key) {
      return (
        <li key={item.id} className="py-1">
          <ItemForm
            initial={draftOf(item)}
            categories={expenseCategories}
            showRepeat
            hint={(draft) =>
              !item.repeats
                ? null
                : draft.repeats
                  ? `Changes apply to ${formatMonth(month)} only.`
                  : `Stops repeating after ${formatMonth(month)}.`
            }
            onSubmit={(draft) => updateItem(item, draft, "month")}
            onCancel={() => setEditing(null)}
          />
        </li>
      );
    }

    const over = !item.dueDay && line.spentCents > item.amountCents;
    const detail = details(item, [item.repeats ? "Repeats monthly" : null]);

    return (
      <li key={item.id} className="group/row space-y-2 py-3">
        <div className="flex items-center gap-3">
          {title(item, detail)}
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
          {actions(item, key, "month")}
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
      <section>
        <h2 className="border-border border-b pb-2">
          <CollapseToggle
            open={defaultsOpen}
            controls="budget-defaults"
            count={defaults.length}
            onToggle={() => setOpen(["defaults"], !defaultsOpen)}
            className="text-muted-foreground text-xs tracking-wide uppercase"
          >
            <span className="truncate">Default items</span>
          </CollapseToggle>
        </h2>
        <CollapseBody id="budget-defaults" open={defaultsOpen}>
          {defaults.length ? (
            <ul className="divide-border divide-y">
              {defaults.map(renderDefault)}
            </ul>
          ) : (
            <p className="text-muted-foreground py-3 text-sm">
              Added to every month. Edits apply from next month on.
            </p>
          )}
          <div className="pt-2 pb-1">
            <ItemForm
              initial={emptyDraft}
              categories={expenseCategories}
              saving={saving}
              onSubmit={(draft) => createItem(draft, "default")}
            />
          </div>
        </CollapseBody>
      </section>

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
        initial={emptyDraft}
        categories={expenseCategories}
        saving={saving}
        showRepeat
        onSubmit={(draft) => createItem(draft, "month")}
      />
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
  showRepeat = false,
  hint,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  categories: CategoryItem[];
  saving?: boolean;
  showRepeat?: boolean;
  hint?: (draft: Draft) => string | null;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const editing = Boolean(onCancel);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) setDraft({ ...draft, name: "", amount: "", notes: "" });
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
      {showRepeat ? (
        <label className="text-muted-foreground flex min-h-9 cursor-pointer items-center gap-2 px-1 text-sm select-none">
          <Checkbox
            checked={draft.repeats}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, repeats: checked })
            }
          />
          Repeat monthly
        </label>
      ) : null}
      <Input
        value={draft.notes}
        onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        placeholder="Notes"
        aria-label="Notes"
        maxLength={500}
        className="min-w-48 flex-1 basis-64"
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
              {draft.type === "bill" ? "Add bill" : "Add limit"}
            </>
          )}
        </Button>
      </div>
      {hint?.(draft) ? (
        <p className="text-muted-foreground basis-full px-1 text-sm">
          {hint(draft)}
        </p>
      ) : null}
    </form>
  );
}
