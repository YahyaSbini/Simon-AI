import { redirect } from "next/navigation";
import { ActivityGroupsView } from "@/components/activity-groups-view";
import { getActivityGroups } from "@/lib/activity-groups";
import { getActivities } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function HobbiesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [groups, activities] = await Promise.all([
    getActivityGroups(session.user.id, "hobby"),
    getActivities(session.user.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Hobbies</h1>
        <p className="text-muted-foreground">
          Group your activities into hobby categories. An activity can be in
          more than one.
        </p>
      </header>

      <ActivityGroupsView
        kind="hobby"
        initialGroups={groups}
        initialActivities={activities}
      />
    </div>
  );
}
