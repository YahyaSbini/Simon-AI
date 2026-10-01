"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sendJson } from "@/components/finance/finance-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryItem } from "@/lib/types";

type Kind = CategoryItem["kind"];

export function CategoriesView({
  initialCategories,
}: {
  initialCategories: CategoryItem[];
}) {
  const [categories, setCategories] = useState(initialCategories);

  async function create(kind: Kind, name: string) {
    const result = await sendJson<{ category: CategoryItem }>(
      "/api/finance/categories",
      "POST",
      { kind, name },
    );
    if (!result) {
      toast.error("Couldn't add that category.");
      return false;
    }
    setCategories((current) => [...current, result.category]);
    return true;
  }

  async function rename(category: CategoryItem, name: string) {
    const result = await sendJson<{ category: CategoryItem }>(
      `/api/finance/categories/${category.id}`,
      "PATCH",
      { name },
    );
    if (!result) {
      toast.error("Couldn't rename that category.");
      return false;
    }
    setCategories((current) =>
      current.map((item) => (item.id === category.id ? result.category : item)),
    );
    return true;
  }

  async function remove(category: CategoryItem) {
    const previous = categories;
    setCategories((current) =>
      current.filter((item) => item.id !== category.id),
    );
    const result = await sendJson(
      `/api/finance/categories/${category.id}`,
      "DELETE",
    );
    if (!result) {
      toast.error("Couldn't remove that category.");
      setCategories(previous);
      return;
    }
    toast.success(
      `Removed ${category.name}. Its entries are now uncategorized.`,
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {(
        [
          ["expense", "Expenses"],
          ["income", "Income"],
        ] as const
      ).map(([kind, title]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-muted-foreground border-border border-b pb-2 text-xs tracking-wide uppercase">
            {title}
          </h2>
          <ul>
            {categories
              .filter((item) => item.kind === kind)
              .map((item) => (
                <CategoryRow
                  key={item.id}
                  category={item}
                  onRename={(name) => rename(item, name)}
                  onRemove={() => remove(item)}
                />
              ))}
          </ul>
          <NameForm
            placeholder={
              kind === "expense"
                ? "New expense category"
                : "New income category"
            }
            onSubmit={(name) => create(kind, name)}
          />
        </section>
      ))}
    </div>
  );
}

function CategoryRow({
  category,
  onRename,
  onRemove,
}: {
  category: CategoryItem;
  onRename: (name: string) => Promise<boolean>;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="py-1">
        <NameForm
          initial={category.name}
          placeholder="Category name"
          onSubmit={async (name) => {
            const ok = await onRename(name);
            if (ok) setEditing(false);
            return ok;
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="group/row flex min-h-11 items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Rename ${category.name}`}
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="hover:text-destructive"
          aria-label={`Remove ${category.name}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </span>
    </li>
  );
}

function NameForm({
  initial = "",
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  onSubmit: (name: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(onCancel);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const ok = await onSubmit(trimmed);
    setSaving(false);
    if (ok && !editing) setName("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={40}
        autoFocus={editing}
      />
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
        variant={editing ? "default" : "ghost"}
        size="icon"
        aria-label={editing ? "Save" : placeholder}
        disabled={saving || name.trim().length === 0}
      >
        {editing ? <Check /> : <Plus />}
      </Button>
    </form>
  );
}
