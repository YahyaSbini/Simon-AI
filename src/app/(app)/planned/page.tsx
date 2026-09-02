import { redirect } from "next/navigation";
import { TaskView } from "@/components/task-view";
import { getLists, getTasks } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function PlannedPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [tasks, lists] = await Promise.all([
    getTasks(session.user.id, "planned"),
    getLists(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Planned</h1>
        <p className="text-muted-foreground">Everything with a due date.</p>
      </header>

      <TaskView
        initialTasks={tasks}
        lists={lists}
        view="planned"
        emptyMessage="No due dates set yet."
      />
    </div>
  );
}
