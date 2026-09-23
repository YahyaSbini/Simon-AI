import { ArrowRight, Landmark, Sun } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDay } from "@/lib/dates";
import { getMyDayTasks, getRoutineOccurrences } from "@/lib/data";
import { getSession } from "@/lib/session";
import { getTimeZone, todayIn } from "@/lib/timezone";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const timeZone = await getTimeZone();
  const date = todayIn(timeZone);
  const [tasks, routines] = await Promise.all([
    getMyDayTasks(session.user.id, date),
    getRoutineOccurrences(session.user.id, date),
  ]);

  const openRoutines = routines.filter((item) => !item.completed).length;
  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl">
          {firstName ? `Hello, ${firstName}` : "Hello"}
        </h1>
        <p className="text-muted-foreground">{formatDay(date)}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard
          href="/my-day"
          title="My-Day"
          icon={Sun}
          summary={summarizeDay(tasks.length, openRoutines)}
        />
        <ModuleCard
          href="/finance"
          title="Financial Management"
          icon={Landmark}
          summary="Track spending, budgets and accounts."
        />
      </div>
    </div>
  );
}

function summarizeDay(tasks: number, routines: number): string {
  if (tasks === 0 && routines === 0) return "Nothing on your plate yet.";

  const parts = [];
  if (tasks) parts.push(`${tasks} ${tasks === 1 ? "task" : "tasks"}`);
  if (routines)
    parts.push(`${routines} ${routines === 1 ? "routine" : "routines"}`);

  return `${parts.join(" and ")} left today.`;
}

function ModuleCard({
  href,
  title,
  icon: Icon,
  summary,
}: {
  href: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
}) {
  return (
    <Link
      href={href}
      className="group border-border bg-card hover:border-wood/60 focus-visible:ring-ring flex flex-col gap-6 rounded-xl border p-6 transition-colors outline-none focus-visible:ring-2"
    >
      <Icon className="text-wood size-6" />
      <div className="space-y-1">
        <h2 className="font-heading text-xl">{title}</h2>
        <p className="text-muted-foreground text-sm">{summary}</p>
      </div>
      <span className="text-azure mt-auto flex items-center gap-1 text-sm font-medium">
        Open
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
