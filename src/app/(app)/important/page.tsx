import { redirect } from "next/navigation";
import { TaskView } from "@/components/task-view";
import { getLists, getTasks } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function ImportantPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const [tasks, lists] = await Promise.all([
    getTasks(session.user.id, "important"),
    getLists(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">Important</h1>
        <p className="text-muted-foreground">Medium and high priority.</p>
      </header>

      <TaskView
        initialTasks={tasks}
        lists={lists}
        emptyMessage="Nothing urgent. Raise a task's priority and it shows up here."
      />
    </div>
  );
}
