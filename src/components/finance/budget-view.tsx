"use client";

import {
  Check,
  ListChecks,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { sendJson } from "@/components/finance/finance-bits";
import { selectClass } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatMoney, parseAmount, toAmountInput } from "@/lib/money";
import type { EntryKind } from "@/db/schema";
import type { BudgetItemRow, CategoryItem, MoneyItemRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = { name: string; amount: string; categoryId: string };

type Panel = { kind: EntryKind; mode: "pick" | "manual" } | null;

const emptyDraft: Draft = { name: "", amount: "", categoryId: "" };

export function BudgetView({
  month,
  categories,
  moneyItems,
  initialItems,
}: {
  month: string;
  categories: CategoryItem[];
  moneyItems: MoneyItemRow[];
  initialItems: BudgetItemRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [saving, setSaving] = useState(false);
  const categoryName = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  const columns = (["income", "expense"] as const).map((kind) => {
    const mine = items.filter((item) => item.kind === kind);
    return {
      kind,
      label: kind === "income" ? "Income" : "Outcome",
      items: mine,
      sources: moneyItems.filter((item) => item.kind === kind),
      categories: categories.filter((item) => item.kind === kind),
      total: mine.reduce((sum, item) => sum + item.amountCents, 0),
    };
  });
  const [income, outcome] = columns.map((column) => column.total);
  const remaining = income - outcome;

  function toPayload(draft: Draft) {
    const name = draft.name.trim();
    const amountCents = parseAmount(draft.amount);
    if (!name) {
      toast.error("Give the item a name.");
      return null;
    }
    if (!amountCents) {
      toast.error("Enter an amount above zero.");
      return null;
    }
    return { name, amountCents, categoryId: draft.categoryId || null };
  }

  async function post(body: object) {
    setSaving(true);
    const result = await sendJson<{ items: BudgetItemRow[] }>(
      "/api/finance/budget-items",
      "POST",
      body,
    );
    setSaving(false);
    if (!result) {
      toast.error("Couldn't add to this budget.");
      return false;
    }
    setItems((current) => [...current, ...result.items]);
    return true;
  }

  async function addManual(kind: EntryKind, draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    return post({ ...payload, kind, month });
  }

  async function addPicked(moneyItemIds: string[]) {
    if (!moneyItemIds.length) return;
    if (await post({ month, moneyItemIds })) setPanel(null);
  }

  async function updateItem(item: BudgetItemRow, draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    const result = await sendJson<{ item: BudgetItemRow }>(
      `/api/finance/budget-items/${item.id}`,
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

  async function removeItem(item: BudgetItemRow) {
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== item.id));
    const result = await sendJson(
      `/api/finance/budget-items/${item.id}`,
      "DELETE",
    );
    if (!result) {
      toast.error("Couldn't remove that item.");
      setItems(previous);
    }
  }

  function renderBox(item: BudgetItemRow, kindCategories: CategoryItem[]) {
    if (editingId === item.id) {
      return (
        <li
          key={item.id}
          className="border-border bg-card rounded-xl border p-3 sm:col-span-2"
        >
          <ItemForm
            initial={{
              name: item.name,
              amount: toAmountInput(item.amountCents),
              categoryId: item.categoryId ?? "",
            }}
            categories={kindCategories}
            submitLabel="Save"
            onSubmit={(draft) => updateItem(item, draft)}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }

    const category = item.categoryId ? categoryName.get(item.categoryId) : null;

    return (
      <li
        key={item.id}
        className="group/row border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              {item.name}
              {item.moneyItemId ? (
                <Repeat
                  className="text-muted-foreground size-3.5 shrink-0"
                  aria-label="From In/Out Items"
                />
              ) : null}
            </p>
            {category ? (
              <p className="text-muted-foreground truncate text-sm">
                {category}
              </p>
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
        <p className="font-heading mt-auto text-xl tabular-nums">
          {formatMoney(item.amountCents)}
        </p>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <dl className="border-border bg-card divide-border grid divide-y rounded-xl border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Figure label="Income" value={formatMoney(income)} />
        <Figure label="Outcome" value={formatMoney(outcome)} />
        <Figure
          label="Remaining"
          value={formatMoney(remaining)}
          className={cn(
            remaining > 0 && "text-success",
            remaining < 0 && "text-destructive",
          )}
        />
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        {columns.map((column) => {
          const open = panel?.kind === column.kind ? panel.mode : null;
          return (
            <section key={column.kind} className="min-w-0 space-y-3">
              <h2 className="text-muted-foreground flex items-baseline justify-between gap-3 text-xs tracking-wide uppercase">
                {column.label}
                <span className="tabular-nums">
                  {formatMoney(column.total)}
                </span>
              </h2>

              {column.items.length ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {column.items.map((item) =>
                    renderBox(item, column.categories),
                  )}
                </ul>
              ) : (
                <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                  No {column.label.toLowerCase()} planned yet.
                </p>
              )}

              {open === "pick" ? (
                <PickPanel
                  sources={column.sources}
                  added={
                    new Set(column.items.map((item) => item.moneyItemId ?? ""))
                  }
                  saving={saving}
                  onAdd={addPicked}
                  onCancel={() => setPanel(null)}
                />
              ) : open === "manual" ? (
                <div className="border-border bg-card rounded-xl border p-3">
                  <ItemForm
                    initial={emptyDraft}
                    categories={column.categories}
                    placeholder={
                      column.kind === "income" ? "e.g. Salary" : "e.g. Rent"
                    }
                    submitLabel={`Add ${column.label.toLowerCase()}`}
                    saving={saving}
                    onSubmit={(draft) => addManual(column.kind, draft)}
                    onCancel={() => setPanel(null)}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() =>
                      setPanel({ kind: column.kind, mode: "pick" })
                    }
                  >
                    <ListChecks data-icon="inline-start" />
                    Add from items
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() =>
                      setPanel({ kind: column.kind, mode: "manual" })
                    }
                  >
                    <Plus data-icon="inline-start" />
                    Add manually
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PickPanel({
  sources,
  added,
  saving,
  onAdd,
  onCancel,
}: {
  sources: MoneyItemRow[];
  added: Set<string>;
  saving: boolean;
  onAdd: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-3">
      {sources.length ? (
        <ul className="space-y-1">
          {sources.map((item) => {
            const done = added.has(item.id);
            const id = `pick-${item.id}`;
            return (
              <li key={item.id}>
                <label
                  htmlFor={id}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-2 text-sm transition-colors",
                    done
                      ? "text-muted-foreground"
                      : "hover:bg-muted/50 cursor-pointer",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={done || picked.includes(item.id)}
                    disabled={done}
                    onCheckedChange={() => toggle(item.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="tabular-nums">
                    {formatMoney(item.amountCents)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground px-2 py-2 text-sm">
          Nothing here yet. Add items in{" "}
          <Link href="/finance/items" className="text-azure hover:underline">
            In/Out Items
          </Link>
          .
        </p>
      )}
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving || !picked.length}
          onClick={() => onAdd(picked)}
        >
          <Plus data-icon="inline-start" />
          Add{picked.length ? ` ${picked.length}` : ""}
        </Button>
      </div>
    </div>
  );
}

function ItemForm({
  initial,
  categories,
  placeholder,
  submitLabel,
  saving = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  categories: CategoryItem[];
  placeholder?: string;
  submitLabel: string;
  saving?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const editing = Boolean(initial.name);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) setDraft({ ...draft, name: "", amount: "" });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        placeholder={placeholder}
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
        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
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
          aria-label={editing ? submitLabel : undefined}
        >
          {editing ? (
            <Check />
          ) : (
            <>
              <Plus data-icon="inline-start" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
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
    <div className="flex min-w-0 items-baseline justify-between gap-3 px-4 py-3 sm:block sm:py-4">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "font-heading truncate text-lg tabular-nums sm:mt-1 sm:text-2xl",
          className,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
