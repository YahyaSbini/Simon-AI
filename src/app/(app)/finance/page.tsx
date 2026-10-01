import { redirect } from "next/navigation";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { getFinanceMonth } from "@/lib/finance";
import { isMonthKey, monthOf } from "@/lib/money";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

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
  const month = isMonthKey(requested) ? requested : monthOf(today);
  const data = await getFinanceMonth(session.user.id, month, today);

  return (
    <div className="space-y-6">
      <FinanceHeader
        title="Overview"
        month={month}
        current={monthOf(today)}
        path="/finance"
      />
      <FinanceOverview
        key={month}
        month={month}
        today={today}
        categories={data.categories}
        budget={data.budget}
        initialEntries={data.entries}
      />
    </div>
  );
}
