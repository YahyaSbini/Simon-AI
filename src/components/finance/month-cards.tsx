import Link from "next/link";
import { formatMonth } from "@/lib/money";
import { cn } from "@/lib/utils";

export type MonthCardRow = {
  label: string;
  value: string;
  className?: string;
};

export function MonthCards({
  months,
  current,
  path,
}: {
  months: { month: string; rows: MonthCardRow[] }[];
  current: string;
  path: string;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {months.map((item) => (
        <li key={item.month}>
          <Link
            href={`${path}?month=${item.month}`}
            aria-current={item.month === current ? "date" : undefined}
            className={cn(
              "border-border bg-card focus-visible:ring-ring block space-y-3 rounded-xl border p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2",
              item.month === current && "border-azure",
            )}
          >
            <h2 className="font-heading text-lg">{formatMonth(item.month)}</h2>
            <dl className="space-y-1 text-sm tabular-nums">
              {item.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className={row.className}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}
