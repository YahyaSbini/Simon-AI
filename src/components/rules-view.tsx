"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  CollapseAllButton,
  CollapseBody,
  CollapseToggle,
} from "@/components/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TimeSectionEntry, TimeSectionItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const starters = ["Constraints", "Rules"];

async function send<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

function move<T>(list: T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function RulesView({
  initialSections,
}: {
  initialSections: TimeSectionItem[];
}) {
  const [sections, setSections] = useState(initialSections);
  const latest = useRef(sections);
  latest.current = sections;

  function updateSection(
    id: string,
    change: (section: TimeSectionItem) => TimeSectionItem,
  ) {
    setSections((current) =>
      current.map((section) => (section.id === id ? change(section) : section)),
    );
  }

  async function addSection(title: string) {
    const result = await send<{ section: TimeSectionItem }>(
      "/api/time-sections",
      "POST",
      { title },
    );
    if (!result) {
      toast.error("Couldn't add that section.");
      return false;
    }
    setSections((current) => [...current, result.section]);
    return true;
  }

  async function renameSection(section: TimeSectionItem, title: string) {
    const result = await send(`/api/time-sections/${section.id}`, "PATCH", {
      title,
    });
    if (!result) {
      toast.error("Couldn't rename that section.");
      return false;
    }
    updateSection(section.id, (current) => ({ ...current, title }));
    return true;
  }

  async function removeSection(section: TimeSectionItem) {
    if (
      section.items.length &&
      !window.confirm(
        `Delete "${section.title}" and its ${section.items.length} item${section.items.length === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }
    const previous = latest.current;
    setSections((current) => current.filter((item) => item.id !== section.id));
    if (!(await send(`/api/time-sections/${section.id}`, "DELETE"))) {
      toast.error("Couldn't delete that section.");
      setSections(previous);
    }
  }

  async function moveSection(index: number, offset: number) {
    const previous = latest.current;
    const next = move(previous, index, offset);
    if (next === previous) return;
    setSections(next);
    const ok = await send("/api/time-sections/reorder", "POST", {
      ids: next.map((section) => section.id),
    });
    if (!ok) {
      toast.error("Couldn't save the new order.");
      setSections(previous);
    }
  }

  async function addItem(section: TimeSectionItem, text: string) {
    const result = await send<{ item: TimeSectionEntry }>(
      `/api/time-sections/${section.id}/items`,
      "POST",
      { text },
    );
    if (!result) {
      toast.error("Couldn't add that item.");
      return false;
    }
    updateSection(section.id, (current) => ({
      ...current,
      items: [...current.items, result.item],
    }));
    return true;
  }

  async function editItem(
    section: TimeSectionItem,
    item: TimeSectionEntry,
    text: string,
  ) {
    const result = await send(`/api/time-section-items/${item.id}`, "PATCH", {
      text,
    });
    if (!result) {
      toast.error("Couldn't save that item.");
      return false;
    }
    updateSection(section.id, (current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === item.id ? { ...entry, text } : entry,
      ),
    }));
    return true;
  }

  async function removeItem(section: TimeSectionItem, item: TimeSectionEntry) {
    const previous = latest.current;
    updateSection(section.id, (current) => ({
      ...current,
      items: current.items.filter((entry) => entry.id !== item.id),
    }));
    if (!(await send(`/api/time-section-items/${item.id}`, "DELETE"))) {
      toast.error("Couldn't delete that item.");
      setSections(previous);
    }
  }

  async function moveItem(
    section: TimeSectionItem,
    index: number,
    offset: number,
  ) {
    const previous = latest.current;
    const current = previous.find((entry) => entry.id === section.id);
    if (!current) return;
    const items = move(current.items, index, offset);
    if (items === current.items) return;
    updateSection(section.id, (value) => ({ ...value, items }));
    const ok = await send(
      `/api/time-sections/${section.id}/items/reorder`,
      "POST",
      { ids: items.map((item) => item.id) },
    );
    if (!ok) {
      toast.error("Couldn't save the new order.");
      setSections(previous);
    }
  }

  async function setCollapsed(ids: string[], collapsed: boolean) {
    const previous = latest.current;
    setSections((current) =>
      current.map((section) =>
        ids.includes(section.id) ? { ...section, collapsed } : section,
      ),
    );
    const results = await Promise.all(
      ids.map((id) => send(`/api/time-sections/${id}`, "PATCH", { collapsed })),
    );
    if (results.some((result) => !result)) {
      toast.error("Couldn't save which sections are open.");
      setSections(previous);
    }
  }

  const anyOpen = sections.some((section) => !section.collapsed);

  return (
    <div className="space-y-4">
      {sections.length > 1 && (
        <CollapseAllButton
          anyOpen={anyOpen}
          onClick={(open) =>
            setCollapsed(
              sections
                .filter((section) => section.collapsed === open)
                .map((section) => section.id),
              !open,
            )
          }
        />
      )}

      <div className="space-y-10">
        {sections.length === 0 && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span>Start with a section:</span>
            {starters.map((title) => (
              <Button
                key={title}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSection(title)}
              >
                <Plus data-icon="inline-start" />
                {title}
              </Button>
            ))}
          </div>
        )}

        {sections.map((section, index) => (
          <Section
            key={section.id}
            section={section}
            first={index === 0}
            last={index === sections.length - 1}
            onToggle={() => setCollapsed([section.id], !section.collapsed)}
            onRename={(title) => renameSection(section, title)}
            onRemove={() => removeSection(section)}
            onMove={(offset) => moveSection(index, offset)}
            onAddItem={(text) => addItem(section, text)}
            onEditItem={(item, text) => editItem(section, item, text)}
            onRemoveItem={(item) => removeItem(section, item)}
            onMoveItem={(itemIndex, offset) =>
              moveItem(section, itemIndex, offset)
            }
          />
        ))}

        <TextForm
          placeholder="New section, e.g. Priorities"
          label="Section title"
          submitLabel="Add section"
          maxLength={80}
          onSubmit={addSection}
        />
      </div>
    </div>
  );
}

function Section({
  section,
  first,
  last,
  onToggle,
  onRename,
  onRemove,
  onMove,
  onAddItem,
  onEditItem,
  onRemoveItem,
  onMoveItem,
}: {
  section: TimeSectionItem;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onRename: (title: string) => Promise<boolean>;
  onRemove: () => void;
  onMove: (offset: number) => void;
  onAddItem: (text: string) => Promise<boolean>;
  onEditItem: (item: TimeSectionEntry, text: string) => Promise<boolean>;
  onRemoveItem: (item: TimeSectionEntry) => void;
  onMoveItem: (index: number, offset: number) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="space-y-2">
      {renaming ? (
        <EditForm
          initial={section.title}
          label="Section title"
          maxLength={80}
          onCancel={() => setRenaming(false)}
          onSubmit={async (title) => {
            const ok = await onRename(title);
            if (ok) setRenaming(false);
            return ok;
          }}
        />
      ) : (
        <div className="group/head border-border flex items-center gap-2 border-b pb-2">
          <h2 className="font-heading min-w-0 flex-1 text-xl">
            <CollapseToggle
              open={!section.collapsed}
              controls={`section-${section.id}`}
              count={section.items.length}
              onToggle={onToggle}
            >
              <span className="truncate">{section.title}</span>
            </CollapseToggle>
          </h2>
          <RowActions
            name={section.title}
            first={first}
            last={last}
            group="head"
            onEdit={() => setRenaming(true)}
            onMove={onMove}
            onRemove={onRemove}
          />
        </div>
      )}

      <CollapseBody
        id={`section-${section.id}`}
        open={!section.collapsed}
        className="space-y-2"
      >
        {section.items.length > 0 && (
          <ul className="flex flex-col">
            {section.items.map((item, index) =>
              editingId === item.id ? (
                <li key={item.id} className="py-1">
                  <EditForm
                    initial={item.text}
                    label="Item"
                    maxLength={500}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (text) => {
                      const ok = await onEditItem(item, text);
                      if (ok) setEditingId(null);
                      return ok;
                    }}
                  />
                </li>
              ) : (
                <li
                  key={item.id}
                  className="group/row hover:bg-muted/50 focus-within:bg-muted/50 -mx-2 flex items-start gap-3 rounded-md px-2 py-2 transition-colors duration-150"
                >
                  <span
                    className="bg-wood/70 mt-2.5 size-1.5 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-[15px] leading-relaxed break-words">
                    {item.text}
                  </span>
                  <RowActions
                    name={item.text}
                    first={index === 0}
                    last={index === section.items.length - 1}
                    group="row"
                    onEdit={() => setEditingId(item.id)}
                    onMove={(offset) => onMoveItem(index, offset)}
                    onRemove={() => onRemoveItem(item)}
                  />
                </li>
              ),
            )}
          </ul>
        )}

        <TextForm
          placeholder={`Add to ${section.title}`}
          label={`New item in ${section.title}`}
          submitLabel="Add"
          maxLength={500}
          quiet
          onSubmit={onAddItem}
        />
      </CollapseBody>
    </section>
  );
}

function RowActions({
  name,
  first,
  last,
  group,
  onEdit,
  onMove,
  onRemove,
}: {
  name: string;
  first: boolean;
  last: boolean;
  group: "head" | "row";
  onEdit: () => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center opacity-0 transition-opacity max-md:opacity-100",
        group === "head"
          ? "group-focus-within/head:opacity-100 group-hover/head:opacity-100"
          : "group-focus-within/row:opacity-100 group-hover/row:opacity-100",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${name} up`}
        disabled={first}
        onClick={() => onMove(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${name} down`}
        disabled={last}
        onClick={() => onMove(1)}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${name}`}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:text-destructive"
        aria-label={`Delete ${name}`}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </span>
  );
}

function TextForm({
  placeholder,
  label,
  submitLabel,
  maxLength,
  quiet = false,
  onSubmit,
}: {
  placeholder: string;
  label: string;
  submitLabel: string;
  maxLength: number;
  quiet?: boolean;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSaving(true);
    const ok = await onSubmit(value);
    setSaving(false);
    if (ok) setText("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        className={cn(
          "min-w-0 flex-1",
          quiet &&
            "focus-visible:border-input border-transparent bg-transparent shadow-none dark:bg-transparent",
        )}
      />
      <Button
        type="submit"
        variant={quiet ? "ghost" : "default"}
        disabled={saving || !text.trim()}
      >
        <Plus data-icon="inline-start" />
        {submitLabel}
      </Button>
    </form>
  );
}

function EditForm({
  initial,
  label,
  maxLength,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  maxLength: number;
  onSubmit: (text: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSaving(true);
    await onSubmit(value);
    setSaving(false);
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="bg-muted/50 -mx-2 flex items-center gap-1 rounded-md px-2 py-2"
    >
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label={label}
        maxLength={maxLength}
        autoFocus
        className="min-w-0 flex-1"
      />
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
        size="icon"
        aria-label="Save"
        disabled={saving || !text.trim()}
      >
        <Check />
      </Button>
    </form>
  );
}
