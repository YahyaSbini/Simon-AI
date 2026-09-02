import { redirect } from "next/navigation";
import { RoutinesView } from "@/components/routines-view";
import { getRoutines } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function RoutinesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const routines = await getRoutines(session.user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Routines</h1>
        <p className="text-muted-foreground">
          The things you repeat. They appear on My Day when they are due.
        </p>
      </header>

      <RoutinesView initialRoutines={routines} />
    </div>
  );
}
