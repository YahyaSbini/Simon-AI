import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function FinancePage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Financial Management</h1>
        <p className="text-muted-foreground">
          Spending, budgets and accounts in one place.
        </p>
      </header>

      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-sm">
        Nothing here yet. Tools for tracking money will land in this tab.
      </div>
    </div>
  );
}
