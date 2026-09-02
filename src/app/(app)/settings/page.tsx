import { redirect } from "next/navigation";
import { CalendarConnection } from "@/components/calendar-connection";
import { getCalendarStatus } from "@/lib/calendar";
import { getSession } from "@/lib/session";

export default async function SettingsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const status = await getCalendarStatus(session.user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Settings</h1>
        <p className="text-muted-foreground">
          Signed in as {session.user.email}
        </p>
      </header>

      <CalendarConnection status={status} />
    </div>
  );
}
