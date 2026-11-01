"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CollapseBody,
  CollapseToggle,
  useClosedSections,
} from "@/components/collapsible";
import { sendJson } from "@/components/finance/finance-bits";
import { selectClass } from "@/components/task-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const sections: { kind: EntryKind; title: string; placeholder: string }[] = [
  { kind: "income", title: "Income", placeholder: "e.g. Salary" },
  { kind: "expense", title: "Outcome", placeholder: "e.g. Rent" },
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
  const [addingKind, setAddingKind] = useState<EntryKind | null>(null);
  const [saving, setSaving] = useState(false);
  const { closed, setOpen } = useClosedSections("finance-items-closed");
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
    setAddingKind(null);
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
        <li key={item.id} className="list-none py-1">
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
            placeholder={item.name}
            categories={categories}
            amountNote={`A new amount applies from ${formatMonth(addMonths(currentMonth, 1))}.`}
            onSubmit={(draft) => updateItem(item, draft)}
            editing
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }

    const category = item.categoryId
      ? categoryName.get(item.categoryId)
      : undefined;
    const repetition = item.repeats
      ? `Every month on the ${ordinal(item.day)}, from ${formatMonth(item.startMonth)}`
      : `Once, ${ordinal(item.day)} of ${formatMonth(item.startMonth)}`;

    return (
      <li key={item.id} className="group/row py-1.5">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger className="flex min-w-0 flex-1 cursor-default items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <span className="truncate text-sm font-medium">{item.name}</span>
              {category ? (
                <Badge variant="secondary" className="font-normal">
                  {category}
                </Badge>
              ) : null}
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              {repetition}
            </TooltipContent>
          </Tooltip>
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
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => {
        const open = !closed.has(section.kind);
        const rows = items.filter((item) => item.kind === section.kind);
        return (
          <section key={section.kind} className="space-y-3">
            <h2 className="font-heading flex items-center gap-1 text-xl">
              <CollapseToggle
                open={open}
                controls={`items-${section.kind}`}
                count={rows.length}
                onToggle={() => setOpen([section.kind], !open)}
                className="w-auto"
              >
                {section.title}
              </CollapseToggle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label={`Add ${section.title.toLowerCase()}`}
                onClick={() => {
                  setOpen([section.kind], true);
                  setAddingKind(section.kind);
                }}
              >
                <Plus />
              </Button>
            </h2>
            <CollapseBody
              id={`items-${section.kind}`}
              open={open}
              className="space-y-3"
            >
              {rows.length ? (
                <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
                  {rows.map(renderItem)}
                </ul>
              ) : null}
              {addingKind === section.kind ? (
                <ItemForm
                  initial={{
                    kind: section.kind,
                    name: "",
                    amount: "",
                    categoryId: "",
                    day: "1",
                    startMonth: currentMonth,
                    repeats: true,
                  }}
                  placeholder={section.placeholder}
                  categories={categories}
                  saving={saving}
                  onSubmit={createItem}
                  onCancel={() => setAddingKind(null)}
                />
              ) : null}
            </CollapseBody>
          </section>
        );
      })}
    </div>
  );
}

function ItemForm({
  initial,
  placeholder,
  categories,
  amountNote,
  editing = false,
  saving = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  placeholder: string;
  categories: CategoryItem[];
  amountNote?: string;
  editing?: boolean;
  saving?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const kindCategories = categories.filter((item) => item.kind === draft.kind);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) setDraft({ ...draft, name: "", amount: "" });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-muted/50 -mx-2 space-y-2 rounded-md p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
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
                Add
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
