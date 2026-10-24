"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fieldSelectClass } from "@/components/task-bits";
import { Label } from "@/components/ui/label";
import type { TaskType } from "@/db/schema";
import { cn } from "@/lib/utils";

type LinkTargets = {
  loaded: boolean;
  activities: { id: string; name: string; emoji: string | null }[];
  tasks: { id: string; title: string; completed: boolean }[];
  routines: { id: string; title: string }[];
};

const empty: LinkTargets = {
  loaded: false,
  activities: [],
  tasks: [],
  routines: [],
};

let snapshot = empty;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Reload the tasks, routines and activities that items can be linked under. */
export function refreshLinkTargets(): Promise<void> {
  inflight ??= fetch("/api/link-targets")
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data) return;
      snapshot = { loaded: true, ...data };
      listeners.forEach((listener) => listener());
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLinkTargets(): LinkTargets {
  const targets = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => empty,
  );
  useEffect(() => {
    if (!snapshot.loaded) void refreshLinkTargets();
  }, []);
  return targets;
}

export function needsLink(type: TaskType): boolean {
  return type !== "independent";
}

/** Task (or routine) and Activity pickers for dependent and hybrid items. */
export function LinkFields({
  kind,
  selfId,
  parentId,
  activityId,
  onChange,
  compact = false,
  className,
}: {
  kind: "task" | "routine";
  selfId?: string | null;
  parentId: string | null;
  activityId: string | null;
  onChange: (parentId: string | null, activityId: string | null) => void;
  compact?: boolean;
  className?: string;
}) {
  const targets = useLinkTargets();
  const parentLabel = kind === "task" ? "Task" : "Routine";
  const parents = (
    kind === "task"
      ? targets.tasks.filter((item) => !item.completed || item.id === parentId)
      : targets.routines
  ).filter((item) => item.id !== selfId);
  const missing = !parentId && !activityId;

  const parentSelect = (
    <select
      id={compact ? undefined : `${kind}-link-parent`}
      aria-label={compact ? `Under ${parentLabel.toLowerCase()}` : undefined}
      aria-invalid={missing}
      value={parentId ?? ""}
      onChange={(event) => onChange(event.target.value || null, activityId)}
      className={cn(
        fieldSelectClass,
        compact ? "max-w-44 shrink-0" : "w-full",
        className,
      )}
    >
      <option value="" disabled={!compact && !activityId}>
        {compact ? `${parentLabel}…` : "None"}
      </option>
      {parents.map((item) => (
        <option key={item.id} value={item.id}>
          {item.title}
        </option>
      ))}
    </select>
  );

  const activitySelect = (
    <select
      id={compact ? undefined : `${kind}-link-activity`}
      aria-label={compact ? "Under activity" : undefined}
      aria-invalid={missing}
      value={activityId ?? ""}
      onChange={(event) => onChange(parentId, event.target.value || null)}
      className={cn(
        fieldSelectClass,
        compact ? "max-w-44 shrink-0" : "w-full",
        className,
      )}
    >
      <option value="" disabled={!compact && !parentId}>
        {compact ? "Activity…" : "None"}
      </option>
      {targets.activities.map((item) => (
        <option key={item.id} value={item.id}>
          {[item.emoji, item.name].filter(Boolean).join(" ")}
        </option>
      ))}
    </select>
  );

  if (compact) {
    return (
      <>
        {parentSelect}
        {activitySelect}
      </>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-link-parent`}>{parentLabel}</Label>
          {parentSelect}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-link-activity`}>Activity</Label>
          {activitySelect}
        </div>
      </div>
      <p
        className={cn(
          "text-xs",
          missing ? "text-destructive" : "text-muted-foreground",
        )}
      >
        Pick a {parentLabel.toLowerCase()}, an activity, or both.
      </p>
    </div>
  );
}

/** "↳ 🚗 Driving" under a row, or a prompt when a required link is missing. */
export function LinkMeta({
  kind,
  type,
  parentId,
  activityId,
}: {
  kind: "task" | "routine";
  type: TaskType;
  parentId: string | null;
  activityId: string | null;
}) {
  const targets = useLinkTargets();
  if (!needsLink(type) || !targets.loaded) return null;

  const parents: { id: string; title: string }[] =
    kind === "task" ? targets.tasks : targets.routines;
  const parent = parents.find((item) => item.id === parentId);
  const activity = targets.activities.find((item) => item.id === activityId);
  const labels = [
    parent?.title,
    activity && [activity.emoji, activity.name].filter(Boolean).join(" "),
  ].filter(Boolean);

  if (labels.length === 0) {
    return <span className="text-destructive">Needs a {kind} or activity</span>;
  }

  return <span className="min-w-0 truncate">↳ {labels.join(" · ")}</span>;
}
