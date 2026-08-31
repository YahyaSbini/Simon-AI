import { redirect } from "next/navigation";
import { MyDayView } from "@/components/my-day-view";
import { formatDay, today } from "@/lib/dates";
import { getMyDayTasks, getRoutineOccurrences } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function MyDayPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const date = today();
  const [tasks, routines] = await Promise.all([
    getMyDayTasks(session.user.id, date),
    getRoutineOccurrences(session.user.id, date),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">My Day</h1>
        <p className="text-muted-foreground">{formatDay(date)}</p>
      </header>

      <MyDayView date={date} initialTasks={tasks} initialRoutines={routines} />
    </div>
  );
}
