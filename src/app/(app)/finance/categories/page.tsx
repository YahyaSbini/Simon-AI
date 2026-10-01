import { redirect } from "next/navigation";
import { CategoriesView } from "@/components/finance/categories-view";
import { FinanceHeader } from "@/components/finance/finance-bits";
import { ensureFinanceSetup, getCategories } from "@/lib/finance";
import { getSession } from "@/lib/session";

export default async function CategoriesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  await ensureFinanceSetup(session.user.id);
  const categories = await getCategories(session.user.id);

  return (
    <div className="space-y-6">
      <FinanceHeader title="Categories" />
      <CategoriesView initialCategories={categories} />
    </div>
  );
}
