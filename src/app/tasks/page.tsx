import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { TaskList } from "@/components/task-list";
import { db } from "@/db";
import { task } from "@/db/schema";
import { getSession } from "@/lib/session";

export default async function TasksPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const tasks = await db
    .select()
    .from(task)
    .where(eq(task.userId, session.user.id))
    .orderBy(desc(task.createdAt));

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-8">
      <header className="flex items-center justify-between">
        <BrandMark />
        <SignOutButton />
      </header>

      <main className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl">Tasks</h1>
          <p className="text-muted-foreground">
            {session.user.name
              ? `Everything on your plate, ${session.user.name}.`
              : "Everything on your plate."}
          </p>
        </div>

        <TaskList
          initialTasks={tasks.map((item) => ({
            id: item.id,
            title: item.title,
            completedAt: item.completedAt?.toISOString() ?? null,
          }))}
        />
      </main>
    </div>
  );
}
