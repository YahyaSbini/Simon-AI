import { redirect } from "next/navigation";
import { RoutinesView } from "@/components/routines-view";
import { getRoutines } from "@/lib/data";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function RoutinesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const date = todayIn(await getTimeZone());
  const routines = await getRoutines(session.user.id, date);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Routines</h1>
        <p className="text-muted-foreground">
          The things you repeat. They appear on My Day when they are due.
        </p>
      </header>

      <RoutinesView initialRoutines={routines} date={date} />
    </div>
  );
}
