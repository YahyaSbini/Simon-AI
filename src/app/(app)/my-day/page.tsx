import { redirect } from "next/navigation";
import { MyDayView } from "@/components/my-day-view";
import { getCalendarAgenda } from "@/lib/calendar";
import { formatDay } from "@/lib/dates";
import { getMyDayTasks, getRoutineOccurrences } from "@/lib/data";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function MyDayPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const timeZone = await getTimeZone();
  const date = todayIn(timeZone);
  const [tasks, routines, agenda] = await Promise.all([
    getMyDayTasks(session.user.id, date),
    getRoutineOccurrences(session.user.id, date),
    getCalendarAgenda(session.user.id, date, timeZone),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">My Day</h1>
        <p className="text-muted-foreground">{formatDay(date)}</p>
      </header>

      <MyDayView
        date={date}
        initialTasks={tasks}
        initialRoutines={routines}
        agenda={agenda}
      />
    </div>
  );
}
