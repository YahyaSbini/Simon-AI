import { redirect } from "next/navigation";
import { TaskView } from "@/components/task-view";
import { getLists, getTasks } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function TasksPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [tasks, lists] = await Promise.all([
    getTasks(session.user.id, "all"),
    getLists(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Tasks</h1>
        <p className="text-muted-foreground">Everything on your plate.</p>
      </header>

      <TaskView
        initialTasks={tasks}
        lists={lists}
        emptyMessage="Nothing here yet. Add your first task above."
      />
    </div>
  );
}
