"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { addMonths, formatMonth } from "@/lib/money";
import { cn } from "@/lib/utils";

export function FinanceHeader({
  title,
  month,
  current,
  path,
}: {
  title: string;
  month?: string;
  current?: string;
  path?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-heading text-3xl">{title}</h1>
      {month && current && path ? (
        <MonthSwitcher month={month} current={current} path={path} />
      ) : null}
    </header>
  );
}

function MonthSwitcher({
  month,
  current,
  path,
}: {
  month: string;
  current: string;
  path: string;
}) {
  const href = (target: string) =>
    target === current ? path : `${path}?month=${target}`;

  return (
    <nav aria-label="Month" className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous month"
        render={<Link href={href(addMonths(month, -1))} />}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium tabular-nums">
        {formatMonth(month)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next month"
        render={<Link href={href(addMonths(month, 1))} />}
      >
        <ChevronRight />
      </Button>
      {month !== current ? (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          render={<Link href={path} />}
        >
          This month
        </Button>
      ) : null}
    </nav>
  );
}

export function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const over = value > max;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="bg-muted h-1.5 overflow-hidden rounded-full"
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none",
          over ? "bg-destructive" : "bg-wood",
        )}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="border-border inline-flex h-8 shrink-0 rounded-lg border p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "focus-visible:ring-ring rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2",
            value === option.value
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export async function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T | null> {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}
