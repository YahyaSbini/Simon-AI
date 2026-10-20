import { redirect } from "next/navigation";
import { ActivitiesView } from "@/components/activities-view";
import { activityUsage, unlinkedBlockCount } from "@/lib/activities";
import { getActivities } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function ActivitiesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [activities, usage, unlinked] = await Promise.all([
    getActivities(session.user.id),
    activityUsage(session.user.id),
    unlinkedBlockCount(session.user.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Activities</h1>
        <p className="text-muted-foreground">
          The things you spend your day on. Blocks on the Day Structure table
          are picked from this list.
        </p>
      </header>

      <ActivitiesView
        initialActivities={activities}
        initialUsage={usage}
        unlinked={unlinked}
      />
    </div>
  );
}
