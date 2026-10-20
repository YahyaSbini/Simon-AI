"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ColorPicker, EmojiPicker, fill } from "@/components/activity-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { asBlockColor, type BlockColor } from "@/lib/block-colors";
import type { ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = { name: string; emoji: string | null; color: BlockColor };

const starters: Draft[] = [
  { name: "Sleep", emoji: "😴", color: "indigo" },
  { name: "Transportation", emoji: "🚗", color: "slate" },
  { name: "Work", emoji: "💼", color: "azure" },
  { name: "Gym", emoji: "🏋️", color: "orange" },
  { name: "Meals", emoji: "🍽️", color: "amber" },
];

async function send(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: {} };
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function ActivitiesView({
  initialActivities,
  initialUsage,
  unlinked: initialUnlinked,
}: {
  initialActivities: ActivityItem[];
  initialUsage: Record<string, number>;
  unlinked: number;
}) {
  const [activities, setActivities] = useState(initialActivities);
  const [usage, setUsage] = useState(initialUsage);
  const [unlinked, setUnlinked] = useState(initialUnlinked);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const latest = useRef(activities);
  latest.current = activities;

  async function add(draft: Draft) {
    const { ok, data } = await send("/api/activities", "POST", draft);
    if (!ok) {
      toast.error("Couldn't add that activity.");
      return false;
    }
    setActivities((current) => [...current, data.activity as ActivityItem]);
    return true;
  }

  async function save(id: string, draft: Draft) {
    const { ok, data } = await send(`/api/activities/${id}`, "PATCH", draft);
    if (!ok) {
      toast.error("Couldn't save that activity.");
      return false;
    }
    const updated = data.activity as ActivityItem;
    setActivities((current) =>
      current.map((item) => (item.id === id ? updated : item)),
    );
    return true;
  }

  async function remove(item: ActivityItem) {
    const uses = usage[item.id] ?? 0;
    if (uses > 0) {
      toast.error(
        `${item.name} is used by ${plural(uses, "block")} in Day Structure. Remove those blocks first.`,
      );
      return;
    }
    const previous = latest.current;
    setActivities((current) => current.filter((entry) => entry.id !== item.id));
    const { ok, data } = await send(`/api/activities/${item.id}`, "DELETE");
    if (!ok) {
      toast.error(
        typeof data.error === "string"
          ? data.error
          : "Couldn't delete that activity.",
      );
      setActivities(previous);
    }
  }

  async function moveBy(index: number, offset: number) {
    const previous = latest.current;
    const target = index + offset;
    if (target < 0 || target >= previous.length) return;
    const next = [...previous];
    [next[index], next[target]] = [next[target], next[index]];
    setActivities(next);
    const { ok } = await send("/api/activities/reorder", "POST", {
      ids: next.map((item) => item.id),
    });
    if (!ok) {
      toast.error("Couldn't save the new order.");
      setActivities(previous);
    }
  }

  async function importBlocks() {
    setImporting(true);
    const { ok, data } = await send("/api/activities/import", "POST");
    setImporting(false);
    if (!ok) {
      toast.error("Couldn't create activities from your blocks.");
      return;
    }
    setActivities(data.activities as ActivityItem[]);
    setUsage(data.usage as Record<string, number>);
    setUnlinked(0);
    toast.success(`Linked ${plural(data.linked as number, "block")}.`);
  }

  const missing = starters.filter(
    (starter) =>
      !activities.some(
        (item) => item.name.toLowerCase() === starter.name.toLowerCase(),
      ),
  );

  return (
    <div className="space-y-6">
      {unlinked > 0 && (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
          <p className="text-sm">
            {plural(unlinked, "block")} in your Day Structure{" "}
            {unlinked === 1 ? "isn't" : "aren't"} linked to an activity yet.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={importBlocks}
          >
            Create activities from them
          </Button>
        </div>
      )}

      {activities.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">
          No activities yet. Add the things you spend your day on, then place
          them on the Day Structure table.
        </p>
      ) : (
        <ul className="flex flex-col">
          {activities.map((item, index) =>
            editingId === item.id ? (
              <li key={item.id} className="py-1">
                <ActivityForm
                  initial={{
                    name: item.name,
                    emoji: item.emoji,
                    color: asBlockColor(item.color),
                  }}
                  submitLabel="Save"
                  compact
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (draft) => {
                    const ok = await save(item.id, draft);
                    if (ok) setEditingId(null);
                    return ok;
                  }}
                />
              </li>
            ) : (
              <li
                key={item.id}
                className="group/row hover:bg-muted/50 focus-within:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={fill(item.color)}
                  aria-hidden
                />
                <span
                  className="w-6 shrink-0 text-center text-base"
                  aria-hidden
                >
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {item.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {usage[item.id]
                    ? plural(usage[item.id], "block")
                    : "Not used"}
                </span>
                <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${item.name} up`}
                    disabled={index === 0}
                    onClick={() => moveBy(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${item.name} down`}
                    disabled={index === activities.length - 1}
                    onClick={() => moveBy(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
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
                    aria-label={`Delete ${item.name}`}
                    title={
                      usage[item.id]
                        ? `Used by ${plural(usage[item.id], "block")}`
                        : undefined
                    }
                    onClick={() => remove(item)}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {missing.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span>Quick add:</span>
          {missing.map((starter) => (
            <Button
              key={starter.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => add(starter)}
            >
              <span aria-hidden>{starter.emoji}</span>
              {starter.name}
            </Button>
          ))}
        </div>
      )}

      <ActivityForm
        initial={{ name: "", emoji: null, color: "azure" }}
        submitLabel="Add activity"
        resetOnSubmit
        onSubmit={add}
      />
    </div>
  );
}

function ActivityForm({
  initial,
  submitLabel,
  compact = false,
  resetOnSubmit = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  compact?: boolean;
  resetOnSubmit?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the activity a name.");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({ ...draft, name });
    setSaving(false);
    if (ok && resetOnSubmit) {
      setDraft(initial);
      setPicking(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onCancel) onCancel();
      }}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md",
        compact && "bg-muted/50 -mx-2 px-2 py-2",
      )}
    >
      <div className="flex min-w-56 flex-1 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={draft.emoji ? `Emoji ${draft.emoji}` : "Add an emoji"}
          aria-expanded={picking}
          onClick={() => setPicking((value) => !value)}
          className="shrink-0 text-base"
        >
          {draft.emoji ? (
            <span aria-hidden>{draft.emoji}</span>
          ) : (
            <Smile className="text-muted-foreground" />
          )}
        </Button>
        <Input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="New activity, e.g. Reading"
          aria-label="Activity name"
          maxLength={80}
          autoFocus={compact}
          className="min-w-0 flex-1"
        />
      </div>
      <ColorPicker
        value={draft.color}
        onChange={(color) => setDraft({ ...draft, color })}
      />
      <div className="flex items-center gap-1">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel"
            onClick={onCancel}
          >
            <X />
          </Button>
        )}
        <Button
          type="submit"
          size={compact ? "icon" : "default"}
          disabled={saving}
          aria-label={compact ? submitLabel : undefined}
        >
          {compact ? (
            <Check />
          ) : (
            <>
              <Plus data-icon="inline-start" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
      {picking && (
        <EmojiPicker
          value={draft.emoji}
          onPick={(emoji) => {
            setDraft({ ...draft, emoji });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </form>
  );
}
