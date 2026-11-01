import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { MonthCards } from "@/components/finance/month-cards";
import { getFinanceMonth, getYearSummary } from "@/lib/finance";
import { formatMoney, formatMonth, isMonthKey, monthOf } from "@/lib/money";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const year = 2026;

export default async function FinancePage({
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
    const months = await getYearSummary(session.user.id, year, today);
    return (
      <div className="space-y-6">
        <FinanceHeader title="Income and Outcomes" />
        <MonthCards
          path="/finance"
          current={monthOf(today)}
          months={months.map((item) => {
            const left = item.incomeCents - item.outcomeCents;
            return {
              month: item.month,
              rows: [
                { label: "Income", value: formatMoney(item.incomeCents) },
                { label: "Outcome", value: formatMoney(item.outcomeCents) },
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
          href="/finance"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronLeft className="size-4" />
          All months
        </Link>
        <FinanceHeader title={formatMonth(month)} />
      </div>
      <FinanceOverview
        key={month}
        month={month}
        today={today}
        categories={data.categories}
        initialEntries={data.entries}
      />
    </div>
  );
}
