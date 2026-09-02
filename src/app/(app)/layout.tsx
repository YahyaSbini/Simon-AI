import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getLists } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const lists = await getLists(session.user.id);

  return <AppShell lists={lists}>{children}</AppShell>;
}
