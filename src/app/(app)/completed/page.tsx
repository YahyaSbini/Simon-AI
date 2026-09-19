import { redirect } from "next/navigation";
import { TaskView } from "@/components/task-view";
import { getLists, getTasks } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function CompletedPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [tasks, lists] = await Promise.all([
    getTasks(session.user.id, "completed"),
    getLists(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Ticked Tasks</h1>
        <p className="text-muted-foreground">Everything you have ticked off. Untick a task to bring it back.</p>
      </header>

      <TaskView
        initialTasks={tasks}
        lists={lists}
        view="completed"
        emptyMessage="Nothing ticked yet. Completed tasks land here."
      />
    </div>
  );
}
