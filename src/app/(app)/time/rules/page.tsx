import { redirect } from "next/navigation";
import { RulesView } from "@/components/rules-view";
import { getTimeSections } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function RulesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const sections = await getTimeSections(session.user.id);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Time Management</h1>
        <p className="text-muted-foreground">
          Constraints, rules and anything else you plan your time around.
        </p>
      </header>

      <RulesView initialSections={sections} />
    </div>
  );
}
