import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { TaskView } from "@/components/task-view";
import { db } from "@/db";
import { list } from "@/db/schema";
import { getLists, getTasks } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function ListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const { listId } = await params;

  const [current] = await db
    .select()
    .from(list)
    .where(and(eq(list.id, listId), eq(list.userId, session.user.id)));

  if (!current) {
    notFound();
  }

  const [tasks, lists] = await Promise.all([
    getTasks(session.user.id, "list", { listId }),
    getLists(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl">{current.name}</h1>
      </header>

      <TaskView
        initialTasks={tasks}
        lists={lists}
        listId={listId}
        emptyMessage="This list is empty. Add the first task above."
      />
    </div>
  );
}
