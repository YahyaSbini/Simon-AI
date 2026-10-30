import Link from "next/link";
import type { MonthSummary } from "@/lib/finance";
import { formatMoney, formatMonth } from "@/lib/money";
import { cn } from "@/lib/utils";

export function MonthCards({
  months,
  current,
}: {
  months: MonthSummary[];
  current: string;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {months.map((item) => {
        const left = item.incomeCents - item.outcomeCents;
        return (
          <li key={item.month}>
            <Link
              href={`/finance?month=${item.month}`}
              aria-current={item.month === current ? "date" : undefined}
              className={cn(
                "border-border bg-card focus-visible:ring-ring block space-y-3 rounded-xl border p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2",
                item.month === current && "border-azure",
              )}
            >
              <h2 className="font-heading text-lg">
                {formatMonth(item.month)}
              </h2>
              <dl className="space-y-1 text-sm tabular-nums">
                <Row label="Income" value={formatMoney(item.incomeCents)} />
                <Row label="Outcome" value={formatMoney(item.outcomeCents)} />
                <Row
                  label="Left"
                  value={formatMoney(left)}
                  className={cn("font-medium", left < 0 && "text-destructive")}
                />
              </dl>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}
