import { redirect } from "next/navigation";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { ItemsView } from "@/components/finance/items-view";
import { ensureFinanceSetup, getCategories } from "@/lib/finance";
import { monthOf } from "@/lib/money";
import { fillItemMonths, getMoneyItems } from "@/lib/money-items";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function ItemsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const userId = session.user.id;
  const today = todayIn(await getTimeZone());
  await ensureFinanceSetup(userId);
  await fillItemMonths(userId, today);
  const [categories, items] = await Promise.all([
    getCategories(userId),
    getMoneyItems(userId),
  ]);

  return (
    <div className="space-y-6">
      <FinanceHeader title="In/Out Items" />
      <ItemsView
        currentMonth={monthOf(today)}
        categories={categories}
        initialItems={items}
      />
    </div>
  );
}
