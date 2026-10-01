import { redirect } from "next/navigation";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { SavingsView } from "@/components/finance/savings-view";
import { getCurrency, getSavingsGoals } from "@/lib/finance";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function SavingsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [currency, goals, timeZone] = await Promise.all([
    getCurrency(session.user.id),
    getSavingsGoals(session.user.id),
    getTimeZone(),
  ]);

  return (
    <div className="space-y-6">
      <FinanceHeader title="Savings" />
      <SavingsView
        today={todayIn(timeZone)}
        currency={currency}
        initialGoals={goals}
      />
    </div>
  );
}
