import { redirect } from "next/navigation";
import { ActivityGroupsView } from "@/components/activity-groups-view";
import { getActivityGroups } from "@/lib/activity-groups";
import { getActivities } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function TimeInvestmentPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [groups, activities] = await Promise.all([
    getActivityGroups(session.user.id, "investment"),
    getActivities(session.user.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Time Investment</h1>
        <p className="text-muted-foreground">
          What you can do at the same time as another activity, like listening
          to a documentary at the gym.
        </p>
      </header>

      <ActivityGroupsView
        kind="investment"
        initialGroups={groups}
        initialActivities={activities}
      />
    </div>
  );
}
