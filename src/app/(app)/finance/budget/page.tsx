import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BudgetView } from "@/components/finance/budget-view";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { MonthCards } from "@/components/finance/month-cards";
import { getBudgetYearSummary, getFinanceMonth } from "@/lib/finance";
import { formatMoney, formatMonth, isMonthKey, monthOf } from "@/lib/money";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const year = 2026;

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const today = todayIn(await getTimeZone());
  const requested = (await searchParams).month;

  if (!isMonthKey(requested)) {
    const months = await getBudgetYearSummary(session.user.id, year, today);
    return (
      <div className="space-y-6">
        <FinanceHeader title="Budget" />
        <MonthCards
          path="/finance/budget"
          current={monthOf(today)}
          months={months.map((item) => {
            const left = item.plannedCents - item.spentCents;
            return {
              month: item.month,
              rows: [
                { label: "Planned", value: formatMoney(item.plannedCents) },
                { label: "Spent", value: formatMoney(item.spentCents) },
                {
                  label: "Left",
                  value: formatMoney(left),
                  className: cn("font-medium", left < 0 && "text-destructive"),
                },
              ],
            };
          })}
        />
      </div>
    );
  }

  const month = requested;
  const data = await getFinanceMonth(session.user.id, month, today);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/finance/budget"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronLeft className="size-4" />
          All months
        </Link>
        <FinanceHeader title={`Budget · ${formatMonth(month)}`} />
      </div>
      <BudgetView
        key={month}
        month={month}
        today={today}
        categories={data.categories}
        initialItems={data.budget}
        initialEntries={data.entries}
      />
    </div>
  );
}
