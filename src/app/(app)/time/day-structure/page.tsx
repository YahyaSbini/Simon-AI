import { redirect } from "next/navigation";
import { DayStructureView } from "@/components/day-structure-view";
import { getDayBlocks } from "@/lib/data";
import { isoWeekday } from "@/lib/day-structure";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function DayStructurePage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [blocks, timeZone] = await Promise.all([
    getDayBlocks(session.user.id),
    getTimeZone(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Day Structure</h1>
        <p className="text-muted-foreground">
          Your standard week. Pick one or more days and lay out the blocks they
          share.
        </p>
      </header>

      <DayStructureView
        initialBlocks={blocks}
        today={isoWeekday(todayIn(timeZone))}
      />
    </div>
  );
}
