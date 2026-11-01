import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BudgetView } from "@/components/finance/budget-view";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { MonthCards } from "@/components/finance/month-cards";
import {
  ensureFinanceSetup,
  getBudgetItems,
  getBudgetYearSummary,
  getCategories,
} from "@/lib/finance";
import { formatMoney, formatMonth, isMonthKey, monthOf } from "@/lib/money";
import { getMoneyItems } from "@/lib/money-items";
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

  const userId = session.user.id;
  const today = todayIn(await getTimeZone());
  const requested = (await searchParams).month;

  if (!isMonthKey(requested)) {
    const months = await getBudgetYearSummary(userId, year);
    return (
      <div className="space-y-6">
        <FinanceHeader title="Budget" />
        <MonthCards
          path="/finance/budget"
          current={monthOf(today)}
          months={months.map((item) => {
            const remaining = item.incomeCents - item.outcomeCents;
            return {
              month: item.month,
              rows: [
                { label: "Income", value: formatMoney(item.incomeCents) },
                { label: "Outcome", value: formatMoney(item.outcomeCents) },
                {
                  label: "Remaining",
                  value: formatMoney(remaining),
                  className: cn(
                    "font-medium",
                    remaining > 0 && "text-success",
                    remaining < 0 && "text-destructive",
                  ),
                },
              ],
            };
          })}
        />
      </div>
    );
  }

  const month = requested;
  await ensureFinanceSetup(userId);
  const [categories, items, moneyItems] = await Promise.all([
    getCategories(userId),
    getBudgetItems(userId, month),
    getMoneyItems(userId),
  ]);

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
        categories={categories}
        moneyItems={moneyItems}
        initialItems={items}
      />
    </div>
  );
}
