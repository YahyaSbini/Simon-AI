"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Segmented, sendJson } from "@/components/finance/finance-bits";
import { selectClass } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  addMonths,
  formatMoney,
  formatMonth,
  isMonthKey,
  ordinal,
  parseAmount,
  toAmountInput,
} from "@/lib/money";
import type { EntryKind } from "@/db/schema";
import type { CategoryItem, MoneyItemRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = {
  kind: EntryKind;
  name: string;
  amount: string;
  categoryId: string;
  day: string;
  startMonth: string;
  repeats: boolean;
};

const kindOptions: { value: EntryKind; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Outcome" },
];

export function ItemsView({
  currentMonth,
  categories,
  initialItems,
}: {
  currentMonth: string;
  categories: CategoryItem[];
  initialItems: MoneyItemRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categoryName = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  function toPayload(draft: Draft) {
    const name = draft.name.trim();
    const amountCents = parseAmount(draft.amount);
    const day = Number(draft.day);
    if (!name) {
      toast.error("Give the item a name.");
      return null;
    }
    if (!amountCents) {
      toast.error("Enter an amount above zero.");
      return null;
    }
    if (!(Number.isInteger(day) && day >= 1 && day <= 31)) {
      toast.error("Pick a day of the month, 1 to 31.");
      return null;
    }
    if (!isMonthKey(draft.startMonth)) {
      toast.error("Pick the month it starts in.");
      return null;
    }
    return {
      kind: draft.kind,
      name,
      amountCents,
      categoryId: draft.categoryId || null,
      day,
      repeats: draft.repeats,
    };
  }

  async function createItem(draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    setSaving(true);
    const result = await sendJson<{ item: MoneyItemRow }>(
      "/api/finance/items",
      "POST",
      { ...payload, startMonth: draft.startMonth },
    );
    setSaving(false);
    if (!result) {
      toast.error("Couldn't add that item.");
      return false;
    }
    setItems((current) => [...current, result.item]);
    return true;
  }

  async function updateItem(item: MoneyItemRow, draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    const result = await sendJson<{ item: MoneyItemRow }>(
      `/api/finance/items/${item.id}`,
      "PATCH",
      payload,
    );
    if (!result) {
      toast.error("Couldn't save that item.");
      return false;
    }
    setItems((current) =>
      current.map((row) => (row.id === item.id ? result.item : row)),
    );
    setEditingId(null);
    return true;
  }

  async function removeItem(item: MoneyItemRow) {
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== item.id));
    const result = await sendJson(`/api/finance/items/${item.id}`, "DELETE");
    if (!result) {
      toast.error("Couldn't remove that item.");
      setItems(previous);
    }
  }

  function renderItem(item: MoneyItemRow) {
    if (editingId === item.id) {
      return (
        <li key={item.id} className="py-1">
          <ItemForm
            initial={{
              kind: item.kind,
              name: item.name,
              amount: toAmountInput(item.amountCents),
              categoryId: item.categoryId ?? "",
              day: String(item.day),
              startMonth: item.startMonth,
              repeats: item.repeats,
            }}
            categories={categories}
            amountNote={`A new amount applies from ${formatMonth(addMonths(currentMonth, 1))}.`}
            onSubmit={(draft) => updateItem(item, draft)}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }

    const detail = [
      item.categoryId ? categoryName.get(item.categoryId) : null,
      item.repeats
        ? `Every month on the ${ordinal(item.day)}, from ${formatMonth(item.startMonth)}`
        : `Once, ${ordinal(item.day)} of ${formatMonth(item.startMonth)}`,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <li key={item.id} className="group/row flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="text-muted-foreground truncate text-sm">{detail}</p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            item.kind === "income" && "font-medium",
          )}
        >
          {formatMoney(
            item.kind === "income" ? item.amountCents : -item.amountCents,
            { sign: true },
          )}
        </span>
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
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <ItemGroup
        title="Income"
        empty="Salary or any money that comes in, once or every month."
      >
        {items.filter((item) => item.kind === "income").map(renderItem)}
      </ItemGroup>
      <ItemGroup
        title="Outcome"
        empty="Rent, subscriptions or any payment, once or every month."
      >
        {items.filter((item) => item.kind === "expense").map(renderItem)}
      </ItemGroup>
      <ItemForm
        initial={{
          kind: "expense",
          name: "",
          amount: "",
          categoryId: "",
          day: "1",
          startMonth: currentMonth,
          repeats: true,
        }}
        categories={categories}
        saving={saving}
        onSubmit={createItem}
      />
    </div>
  );
}

function ItemGroup({
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
  amountNote,
  saving = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  categories: CategoryItem[];
  amountNote?: string;
  saving?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const editing = Boolean(onCancel);
  const kindCategories = categories.filter((item) => item.kind === draft.kind);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) setDraft({ ...draft, name: "", amount: "" });
  }

  return (
    <form
      onSubmit={submit}
      className={cn("space-y-2 rounded-md", editing && "bg-muted/50 -mx-2 p-2")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Income or outcome"
          value={draft.kind}
          options={kindOptions}
          onChange={(kind) => setDraft({ ...draft, kind, categoryId: "" })}
        />
        <Input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder={draft.kind === "income" ? "e.g. Salary" : "e.g. Rent"}
          aria-label="Name"
          maxLength={80}
          autoFocus={editing}
          className="min-w-36 flex-1"
        />
        <Input
          value={draft.amount}
          onChange={(event) =>
            setDraft({ ...draft, amount: event.target.value })
          }
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Amount"
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
          {kindCategories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
          Day
          <Input
            type="number"
            min={1}
            max={31}
            value={draft.day}
            onChange={(event) =>
              setDraft({ ...draft, day: event.target.value })
            }
            aria-label="Day of month"
            className="w-16 tabular-nums"
          />
        </label>
        {editing ? null : (
          <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
            From
            <Input
              type="month"
              value={draft.startMonth}
              onChange={(event) =>
                setDraft({ ...draft, startMonth: event.target.value })
              }
              aria-label="Start month"
              className="w-40"
            />
          </label>
        )}
        <label className="text-muted-foreground flex min-h-9 cursor-pointer items-center gap-2 px-1 text-sm select-none">
          <Checkbox
            checked={draft.repeats}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, repeats: checked })
            }
          />
          Repeat monthly
        </label>
        <div className="ml-auto flex items-center gap-1">
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
                Add item
              </>
            )}
          </Button>
        </div>
      </div>
      {amountNote ? (
        <p className="text-muted-foreground text-sm">{amountNote}</p>
      ) : null}
    </form>
  );
}
