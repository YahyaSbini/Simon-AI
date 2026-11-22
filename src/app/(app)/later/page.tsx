import { redirect } from "next/navigation";
import { TaskView } from "@/components/task-view";
import { getLists, getTasks } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function LaterPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [tasks, lists] = await Promise.all([
    getTasks(session.user.id, "later"),
    getLists(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Later</h1>
        <p className="text-muted-foreground">
          Parked for the future. Move a task to Tasks when it&apos;s time.
        </p>
      </header>

      <TaskView
        initialTasks={tasks}
        lists={lists}
        view="later"
        emptyMessage="Nothing parked. Move a task here when it can wait."
      />
    </div>
  );
}
