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
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { EmojiPicker, fill } from "@/components/activity-fields";
import {
  CollapseAllButton,
  CollapseBody,
  CollapseToggle,
  useClosedSections,
} from "@/components/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActivityGroupItem, ActivityItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = ActivityGroupItem["kind"];
type Member = ActivityGroupItem["members"][number];
type HobbyDraft = { name: string; emoji: string | null };

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

function move<T>(list: T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function nameOf(item: { emoji: string | null; name: string | null }): string {
  return [item.emoji, item.name].filter(Boolean).join(" ");
}

function errorOf(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" ? data.error : fallback;
}

export function ActivityGroupsView({
  kind,
  initialGroups,
  initialActivities,
}: {
  kind: Kind;
  initialGroups: ActivityGroupItem[];
  initialActivities: ActivityItem[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [activities, setActivities] = useState(initialActivities);
  const [picking, setPicking] = useState(false);
  const { closed, setOpen } = useClosedSections(`time-${kind}-closed`);
  const latest = useRef(groups);
  latest.current = groups;
  const byId = new Map(activities.map((item) => [item.id, item]));

  function labelOf(group: ActivityGroupItem): string {
    const main = group.activityId ? byId.get(group.activityId) : undefined;
    return main ? nameOf(main) : nameOf(group);
  }

  function updateGroup(
    id: string,
    change: (group: ActivityGroupItem) => ActivityGroupItem,
  ) {
    setGroups((current) =>
      current.map((group) => (group.id === id ? change(group) : group)),
    );
  }

  async function createActivity(name: string): Promise<ActivityItem | null> {
    const { ok, data } = await send("/api/activities", "POST", {
      name,
      color: "slate",
    });
    if (!ok) {
      toast.error("Couldn't create that activity.");
      return null;
    }
    const created = data.activity as ActivityItem;
    setActivities((current) => [...current, created]);
    return created;
  }

  async function addGroup(
    body: { activityId: string } | HobbyDraft,
  ): Promise<boolean> {
    const { ok, data } = await send("/api/activity-groups", "POST", {
      kind,
      ...body,
    });
    if (!ok) {
      toast.error(errorOf(data, "Couldn't add that."));
      return false;
    }
    setGroups((current) => [...current, data.group as ActivityGroupItem]);
    return true;
  }

  async function renameGroup(group: ActivityGroupItem, draft: HobbyDraft) {
    const { ok } = await send(
      `/api/activity-groups/${group.id}`,
      "PATCH",
      draft,
    );
    if (!ok) {
      toast.error("Couldn't rename that category.");
      return false;
    }
    updateGroup(group.id, (current) => ({ ...current, ...draft }));
    return true;
  }

  async function removeGroup(group: ActivityGroupItem) {
    const what =
      kind === "investment"
        ? `${labelOf(group)} from Time Investment`
        : `the ${labelOf(group)} category`;
    if (!window.confirm(`Remove ${what}? Your activities are kept.`)) return;

    const { ok } = await send(`/api/activity-groups/${group.id}`, "DELETE");
    if (!ok) {
      toast.error("Couldn't remove that.");
      return;
    }
    setGroups((current) => current.filter((item) => item.id !== group.id));
  }

  async function moveGroup(index: number, offset: number) {
    const previous = latest.current;
    const next = move(previous, index, offset);
    if (next === previous) return;
    setGroups(next);
    const { ok } = await send("/api/activity-groups/reorder", "POST", {
      kind,
      ids: next.map((group) => group.id),
    });
    if (!ok) {
      toast.error("Couldn't save the new order.");
      setGroups(previous);
    }
  }

  async function addMember(group: ActivityGroupItem, activityId: string) {
    const { ok, data } = await send(
      `/api/activity-groups/${group.id}/members`,
      "POST",
      { activityId },
    );
    if (!ok) {
      toast.error(errorOf(data, "Couldn't add that activity."));
      return false;
    }
    const member = data.member as Member;
    updateGroup(group.id, (current) => ({
      ...current,
      members: [...current.members, member],
    }));
    return true;
  }

  async function addNewMember(group: ActivityGroupItem, name: string) {
    const existing = activities.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    const target = existing ?? (await createActivity(name));
    return target ? addMember(group, target.id) : false;
  }

  async function removeMember(group: ActivityGroupItem, member: Member) {
    const { ok } = await send(
      `/api/activity-groups/${group.id}/members/${member.id}`,
      "DELETE",
    );
    if (!ok) {
      toast.error("Couldn't remove that activity.");
      return;
    }
    updateGroup(group.id, (current) => ({
      ...current,
      members: current.members.filter((item) => item.id !== member.id),
    }));
  }

  async function moveMember(
    group: ActivityGroupItem,
    index: number,
    offset: number,
  ) {
    const previous = latest.current;
    const members = move(group.members, index, offset);
    if (members === group.members) return;
    updateGroup(group.id, (current) => ({ ...current, members }));
    const { ok } = await send(
      `/api/activity-groups/${group.id}/members/reorder`,
      "POST",
      { ids: members.map((member) => member.id) },
    );
    if (!ok) {
      toast.error("Couldn't save the new order.");
      setGroups(previous);
    }
  }

  const used = new Set(groups.map((group) => group.activityId));
  const mainChoices = activities.filter((item) => !used.has(item.id));

  const anyOpen = groups.some((group) => !closed.has(group.id));

  return (
    <div className="space-y-4">
      {groups.length > 1 && (
        <CollapseAllButton
          anyOpen={anyOpen}
          onClick={(open) =>
            setOpen(
              groups.map((group) => group.id),
              open,
            )
          }
        />
      )}

      <div className="space-y-10">
        {groups.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {kind === "investment"
              ? "Nothing here yet. Pick an activity, then attach what you can do during it."
              : "No categories yet. Add one, then assign activities to it."}
          </p>
        )}

        {groups.map((group, index) => (
          <GroupSection
            key={group.id}
            group={group}
            label={labelOf(group)}
            main={group.activityId ? byId.get(group.activityId) : undefined}
            activities={activities}
            first={index === 0}
            last={index === groups.length - 1}
            open={!closed.has(group.id)}
            onToggle={() => setOpen([group.id], closed.has(group.id))}
            onRename={
              kind === "hobby"
                ? (draft) => renameGroup(group, draft)
                : undefined
            }
            onRemove={() => removeGroup(group)}
            onMove={(offset) => moveGroup(index, offset)}
            onAddMember={(activityId) => addMember(group, activityId)}
            onAddNew={(name) => addNewMember(group, name)}
            onRemoveMember={(member) => removeMember(group, member)}
            onMoveMember={(memberIndex, offset) =>
              moveMember(group, memberIndex, offset)
            }
          />
        ))}

        {kind === "hobby" ? (
          <HobbyForm submitLabel="Add category" onSubmit={addGroup} />
        ) : activities.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            <Link
              href="/time/activities"
              className="text-foreground underline underline-offset-4"
            >
              Add your activities
            </Link>{" "}
            first, then come back to attach them to each other.
          </p>
        ) : (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              aria-expanded={picking}
              disabled={mainChoices.length === 0}
              onClick={() => setPicking((value) => !value)}
            >
              <Plus data-icon="inline-start" />
              Add main activity
            </Button>
            {picking && (
              <ActivityChips
                activities={mainChoices}
                onPick={async (id) => {
                  if (await addGroup({ activityId: id })) setPicking(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupSection({
  group,
  label,
  main,
  activities,
  first,
  last,
  open,
  onToggle,
  onRename,
  onRemove,
  onMove,
  onAddMember,
  onAddNew,
  onRemoveMember,
  onMoveMember,
}: {
  group: ActivityGroupItem;
  label: string;
  main?: ActivityItem;
  activities: ActivityItem[];
  first: boolean;
  last: boolean;
  open: boolean;
  onToggle: () => void;
  onRename?: (draft: HobbyDraft) => Promise<boolean>;
  onRemove: () => void;
  onMove: (offset: number) => void;
  onAddMember: (activityId: string) => Promise<boolean>;
  onAddNew: (name: string) => Promise<boolean>;
  onRemoveMember: (member: Member) => void;
  onMoveMember: (index: number, offset: number) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const byId = new Map(activities.map((item) => [item.id, item]));
  const taken = new Set([
    group.activityId,
    ...group.members.map((member) => member.activityId),
  ]);
  const choices = activities.filter((item) => !taken.has(item.id));

  return (
    <section className="space-y-2">
      {renaming && onRename ? (
        <HobbyForm
          initial={{ name: group.name ?? "", emoji: group.emoji }}
          submitLabel="Save"
          compact
          onCancel={() => setRenaming(false)}
          onSubmit={async (draft) => {
            const ok = await onRename(draft);
            if (ok) setRenaming(false);
            return ok;
          }}
        />
      ) : (
        <div className="group/head border-border flex items-center gap-2 border-b pb-2">
          <h2 className="font-heading min-w-0 flex-1 text-xl">
            <CollapseToggle
              open={open}
              controls={`group-${group.id}`}
              count={group.members.length}
              onToggle={onToggle}
            >
              {main && (
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={fill(main.color)}
                  aria-hidden
                />
              )}
              <span className="truncate">{label}</span>
            </CollapseToggle>
          </h2>
          <RowActions
            name={label}
            first={first}
            last={last}
            group="head"
            onEdit={onRename ? () => setRenaming(true) : undefined}
            onMove={onMove}
            onRemove={onRemove}
          />
        </div>
      )}

      <CollapseBody id={`group-${group.id}`} open={open} className="space-y-2">
        {group.members.length > 0 ? (
          <ul className="flex flex-col">
            {group.members.map((member, index) => {
              const item = byId.get(member.activityId);
              const name = item ? nameOf(item) : "Activity";
              return (
                <li
                  key={member.id}
                  className="group/row hover:bg-muted/50 focus-within:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={fill(item?.color ?? null)}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    {name}
                  </span>
                  <RowActions
                    name={name}
                    first={index === 0}
                    last={index === group.members.length - 1}
                    group="row"
                    removeIcon="x"
                    onMove={(offset) => onMoveMember(index, offset)}
                    onRemove={() => onRemoveMember(member)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground py-1 text-sm">
            {group.kind === "investment"
              ? "Nothing attached yet."
              : "No activities in this category yet."}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2"
          aria-expanded={adding}
          onClick={() => setAdding((value) => !value)}
        >
          <Plus data-icon="inline-start" />
          Add activity
        </Button>
        {adding && (
          <ActivityChips
            activities={choices}
            onPick={onAddMember}
            onCreate={onAddNew}
          />
        )}
      </CollapseBody>
    </section>
  );
}

function ActivityChips({
  activities,
  onPick,
  onCreate,
}: {
  activities: ActivityItem[];
  onPick: (id: string) => unknown;
  onCreate?: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (!value || !onCreate) return;
    setSaving(true);
    const ok = await onCreate(value);
    setSaving(false);
    if (ok) setName("");
  }

  return (
    <div className="border-border bg-card animate-in fade-in-0 slide-in-from-top-1 space-y-2 rounded-md border p-2 duration-150">
      {activities.length > 0 ? (
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Activities"
        >
          {activities.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onPick(item.id)}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={fill(item.color)}
                aria-hidden
              />
              {nameOf(item)}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground px-1 py-1 text-sm">
          All your activities are already here.
        </p>
      )}
      {onCreate && (
        <form onSubmit={create} className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Or type a new activity"
            aria-label="New activity name"
            maxLength={80}
            className="w-56"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={saving || !name.trim()}
          >
            Add
          </Button>
        </form>
      )}
      <Link
        href="/time/activities"
        className="text-muted-foreground hover:text-foreground inline-block px-1 text-xs underline-offset-4 hover:underline"
      >
        Manage activities
      </Link>
    </div>
  );
}

function HobbyForm({
  initial = { name: "", emoji: null },
  submitLabel,
  compact = false,
  onSubmit,
  onCancel,
}: {
  initial?: HobbyDraft;
  submitLabel: string;
  compact?: boolean;
  onSubmit: (draft: HobbyDraft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the category a name.");
      return;
    }
    setSaving(true);
    const ok = await onSubmit({ ...draft, name });
    setSaving(false);
    if (ok && !compact) {
      setDraft({ name: "", emoji: null });
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
          placeholder="New category, e.g. Creative"
          aria-label="Category name"
          maxLength={80}
          autoFocus={compact}
          className="min-w-0 flex-1"
        />
      </div>
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

function RowActions({
  name,
  first,
  last,
  group,
  removeIcon = "trash",
  onEdit,
  onMove,
  onRemove,
}: {
  name: string;
  first: boolean;
  last: boolean;
  group: "head" | "row";
  removeIcon?: "trash" | "x";
  onEdit?: () => void;
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
      {onEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${name}`}
          onClick={onEdit}
        >
          <Pencil />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:text-destructive"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
      >
        {removeIcon === "x" ? <X /> : <Trash2 />}
      </Button>
    </span>
  );
}
