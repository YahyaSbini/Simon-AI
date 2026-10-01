import { redirect } from "next/navigation";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { SavingsView } from "@/components/finance/savings-view";
import { ensureFinanceSetup, getSavingsGoals } from "@/lib/finance";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function SavingsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  await ensureFinanceSetup(session.user.id);
  const [goals, timeZone] = await Promise.all([
    getSavingsGoals(session.user.id),
    getTimeZone(),
  ]);

  return (
    <div className="space-y-6">
      <FinanceHeader title="Savings" />
      <SavingsView today={todayIn(timeZone)} initialGoals={goals} />
    </div>
  );
}
