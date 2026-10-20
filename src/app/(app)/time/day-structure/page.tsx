import { redirect } from "next/navigation";
import { DayStructureView } from "@/components/day-structure-view";
import { getCalendarWeek } from "@/lib/calendar";
import { getActivities, getDayBlocks } from "@/lib/data";
import { isoWeekday } from "@/lib/day-structure";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function DayStructurePage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const timeZone = await getTimeZone();
  const today = todayIn(timeZone);
  const [blocks, activities, week] = await Promise.all([
    getDayBlocks(session.user.id),
    getActivities(session.user.id),
    getCalendarWeek(session.user.id, today, timeZone),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Day Structure</h1>
        <p className="text-muted-foreground">
          Your standard week. Click or drag on the table to place an activity.
        </p>
      </header>

      <DayStructureView
        initialBlocks={blocks}
        activities={activities}
        today={isoWeekday(today)}
        week={week}
      />
    </div>
  );
}
