"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Meter, sendJson } from "@/components/finance/finance-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatMoney,
  formatMonth,
  maxCents,
  monthOf,
  monthlyPace,
  parseAmount,
  toAmountInput,
} from "@/lib/money";
import type { SavingsGoalItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = { name: string; target: string; targetDate: string };

export function SavingsView({
  today,
  currency,
  initialGoals,
}: {
  today: string;
  currency: string;
  initialGoals: SavingsGoalItem[];
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const money = (cents: number) => formatMoney(cents, currency);
  const saved = goals.reduce((sum, goal) => sum + goal.savedCents, 0);

  function toPayload(draft: Draft) {
    const name = draft.name.trim();
    const targetCents = parseAmount(draft.target);
    if (!name) {
      toast.error("Give the goal a name.");
      return null;
    }
    if (!targetCents) {
      toast.error("Enter a target above zero.");
      return null;
    }
    return { name, targetCents, targetDate: draft.targetDate || null };
  }

  async function createGoal(draft: Draft) {
    const payload = toPayload(draft);
    if (!payload) return false;
    setSaving(true);
    const result = await sendJson<{ goal: SavingsGoalItem }>(
      "/api/finance/goals",
      "POST",
      payload,
    );
    setSaving(false);
    if (!result) {
      toast.error("Couldn't add that goal.");
      return false;
    }
    setGoals((current) => [...current, result.goal]);
    return true;
  }

  async function patchGoal(
    goal: SavingsGoalItem,
    patch: Partial<Omit<SavingsGoalItem, "id">>,
  ) {
    const result = await sendJson<{ goal: SavingsGoalItem }>(
      `/api/finance/goals/${goal.id}`,
      "PATCH",
      patch,
    );
    if (!result) {
      toast.error("Couldn't save that goal.");
      return false;
    }
    setGoals((current) =>
      current.map((item) => (item.id === goal.id ? result.goal : item)),
    );
    return true;
  }

  async function removeGoal(goal: SavingsGoalItem) {
    const previous = goals;
    setGoals((current) => current.filter((item) => item.id !== goal.id));
    const result = await sendJson(`/api/finance/goals/${goal.id}`, "DELETE");
    if (!result) {
      toast.error("Couldn't remove that goal.");
      setGoals(previous);
    }
  }

  return (
    <div className="space-y-8">
      {goals.length ? (
        <p className="text-sm">
          <span className="font-heading text-2xl tabular-nums">
            {money(saved)}
          </span>{" "}
          <span className="text-muted-foreground">
            saved across {goals.length} {goals.length === 1 ? "goal" : "goals"}
          </span>
        </p>
      ) : null}

      {goals.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-8 text-center text-sm">
          No goals yet. Name something you&apos;re saving for and set a target.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y border-y">
          {goals.map((goal) =>
            editingId === goal.id ? (
              <li key={goal.id} className="py-2">
                <GoalForm
                  initial={{
                    name: goal.name,
                    target: toAmountInput(goal.targetCents),
                    targetDate: goal.targetDate ?? "",
                  }}
                  onSubmit={async (draft) => {
                    const payload = toPayload(draft);
                    if (!payload) return false;
                    const ok = await patchGoal(goal, payload);
                    if (ok) setEditingId(null);
                    return ok;
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <GoalRow
                key={goal.id}
                goal={goal}
                today={today}
                money={money}
                onMove={(delta) =>
                  patchGoal(goal, {
                    savedCents: Math.min(
                      maxCents,
                      Math.max(0, goal.savedCents + delta),
                    ),
                  })
                }
                onEdit={() => setEditingId(goal.id)}
                onRemove={() => removeGoal(goal)}
              />
            ),
          )}
        </ul>
      )}

      <GoalForm
        initial={{ name: "", target: "", targetDate: "" }}
        saving={saving}
        onSubmit={createGoal}
      />
    </div>
  );
}

function GoalRow({
  goal,
  today,
  money,
  onMove,
  onEdit,
  onRemove,
}: {
  goal: SavingsGoalItem;
  today: string;
  money: (cents: number) => string;
  onMove: (delta: number) => Promise<boolean>;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const reached = goal.savedCents >= goal.targetCents;
  const pace = monthlyPace(goal, today);

  async function move(direction: 1 | -1) {
    const cents = parseAmount(amount);
    if (!cents) {
      toast.error("Enter an amount above zero.");
      return;
    }
    if (direction === -1 && cents > goal.savedCents) {
      toast.error(`Only ${money(goal.savedCents)} is saved in this goal.`);
      return;
    }
    setBusy(true);
    const ok = await onMove(direction * cents);
    setBusy(false);
    if (ok) setAmount("");
  }

  const detail = reached
    ? "Reached"
    : pace
      ? `${money(pace)} a month to reach it by ${formatMonth(monthOf(goal.targetDate ?? today))}`
      : goal.targetDate && goal.targetDate < today
        ? `Target date passed, ${money(goal.targetCents - goal.savedCents)} to go`
        : `${money(goal.targetCents - goal.savedCents)} to go`;

  return (
    <li className="group/row space-y-3 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{goal.name}</p>
          <p
            className={cn(
              "text-muted-foreground text-sm",
              reached && "text-foreground",
            )}
          >
            {detail}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm tabular-nums">
          {money(goal.savedCents)}{" "}
          <span className="text-muted-foreground">
            of {money(goal.targetCents)}
          </span>
        </p>
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${goal.name}`}
            onClick={onEdit}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="hover:text-destructive"
            aria-label={`Remove ${goal.name}`}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </span>
      </div>
      <Meter
        value={goal.savedCents}
        max={goal.targetCents}
        label={`${goal.name} progress`}
      />
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          move(1);
        }}
      >
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label={`Amount for ${goal.name}`}
          className="w-28 tabular-nums"
        />
        <Button type="submit" variant="outline" size="sm" disabled={busy}>
          Put in
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || goal.savedCents === 0}
          onClick={() => move(-1)}
        >
          Take out
        </Button>
      </form>
    </li>
  );
}

function GoalForm({
  initial,
  saving = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  saving?: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const editing = Boolean(onCancel);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onSubmit(draft);
    if (ok && !editing) setDraft({ name: "", target: "", targetDate: "" });
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md",
        editing && "bg-muted/50 -mx-2 px-2 py-2",
      )}
    >
      <Input
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        placeholder="e.g. Emergency fund, New laptop"
        aria-label="Goal name"
        maxLength={80}
        autoFocus={editing}
        className="min-w-40 flex-1"
      />
      <Input
        value={draft.target}
        onChange={(event) => setDraft({ ...draft, target: event.target.value })}
        inputMode="decimal"
        placeholder="Target"
        aria-label="Target amount"
        className="w-28 tabular-nums"
      />
      <Input
        type="date"
        value={draft.targetDate}
        onChange={(event) =>
          setDraft({ ...draft, targetDate: event.target.value })
        }
        aria-label="Target date (optional)"
        className="w-36 tabular-nums"
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
              Add goal
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
