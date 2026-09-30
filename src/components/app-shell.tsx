"use client";

import {
  CalendarClock,
  CalendarRange,
  CheckCheck,
  Clock,
  Home,
  Landmark,
  ListTodo,
  Menu,
  Plus,
  Repeat,
  Settings,
  Star,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { NavSearch } from "@/components/nav-search";
import { SignOutButton } from "@/components/sign-out-button";
import { TaskStoreProvider } from "@/components/task-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Module = {
  id: "my-day" | "finance" | "time";
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  views: NavItem[];
  /** Route prefixes that belong to this module. */
  routes: string[];
};

export const modules: Module[] = [
  {
    id: "my-day",
    href: "/my-day",
    label: "My Day",
    icon: Sun,
    routes: [
      "/my-day",
      "/important",
      "/planned",
      "/tasks",
      "/routines",
      "/completed",
      "/lists",
    ],
    views: [
      { href: "/my-day", label: "Today", icon: Sun },
      { href: "/important", label: "Important", icon: Star },
      { href: "/planned", label: "Planned", icon: CalendarClock },
      { href: "/tasks", label: "Tasks", icon: ListTodo },
      { href: "/routines", label: "Routines", icon: Repeat },
      { href: "/completed", label: "Ticked Tasks", icon: CheckCheck },
    ],
  },
  {
    id: "finance",
    href: "/finance",
    label: "Financial Management",
    icon: Landmark,
    routes: ["/finance"],
    views: [{ href: "/finance", label: "Overview", icon: Landmark }],
  },
  {
    id: "time",
    href: "/time/day-structure",
    label: "Time Management",
    icon: Clock,
    routes: ["/time"],
    views: [
      {
        href: "/time/day-structure",
        label: "Day Structure",
        icon: CalendarRange,
      },
    ],
  },
];

export function moduleFor(pathname: string): Module | null {
  return (
    modules.find((item) =>
      item.routes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
    ) ?? null
  );
}

export function AppShell({
  lists,
  children,
}: {
  lists: ListItem[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const moduleId = moduleFor(pathname)?.id;
  const wide = moduleId === "my-day" || moduleId === "time";

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border hidden w-64 shrink-0 flex-col gap-6 border-r px-4 py-6 md:flex">
        <div className="flex items-start justify-between">
          <Link href="/home" className="w-fit">
            <BrandMark />
          </Link>
          <HomeButton />
        </div>
        <Nav lists={lists} />
        <SignOutButton />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu" />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-6 px-4 py-6">
              <SheetHeader className="flex-row items-start justify-between p-0 pr-8">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Link
                  href="/home"
                  className="w-fit"
                  onClick={() => setOpen(false)}
                >
                  <BrandMark />
                </Link>
                <HomeButton onNavigate={() => setOpen(false)} />
              </SheetHeader>
              <Nav lists={lists} onNavigate={() => setOpen(false)} />
              <SignOutButton />
            </SheetContent>
          </Sheet>
          <Link href="/home" className="flex-1">
            <BrandMark size={28} />
          </Link>
          <HomeButton />
        </header>

        <main
          className={cn(
            "mx-auto w-full flex-1 px-4 py-6 md:px-8 md:py-10",
            wide ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          <TaskStoreProvider>{children}</TaskStoreProvider>
        </main>
      </div>
    </div>
  );
}

function Nav({
  lists,
  onNavigate,
}: {
  lists: ListItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const current = moduleFor(pathname);

  async function createList(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) return;

    setSaving(true);
    const response = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSaving(false);

    if (!response.ok) {
      toast.error("Couldn't create that list.");
      return;
    }

    const { list } = await response.json();
    setName("");
    onNavigate?.();
    router.push(`/lists/${list.id}`);
    router.refresh();
  }

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
      {current ? (
        <div className="space-y-3">
          <h2 className="font-heading px-2 text-2xl leading-none">
            {current.label}
          </h2>
          {current.id === "my-day" && <NavSearch onNavigate={onNavigate} />}
          <ul className="space-y-0.5">
            {current.views.map((view) => (
              <li key={view.href}>
                <NavLink
                  href={view.href}
                  active={pathname === view.href}
                  onNavigate={onNavigate}
                >
                  <view.icon className="size-4 shrink-0" />
                  {view.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {current?.id === "my-day" ? (
        <div className="space-y-2">
          <p className="text-muted-foreground px-2 text-xs tracking-wide uppercase">
            Lists
          </p>
          <ul className="space-y-0.5">
            {lists.map((item) => (
              <li key={item.id}>
                <NavLink
                  href={`/lists/${item.id}`}
                  active={pathname === `/lists/${item.id}`}
                  onNavigate={onNavigate}
                >
                  <span className="truncate">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <form
            onSubmit={createList}
            className="flex items-center gap-1.5 px-1"
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New list"
              aria-label="New list name"
              maxLength={80}
              className="h-8"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Create list"
              disabled={saving || name.trim().length === 0}
            >
              <Plus />
            </Button>
          </form>
        </div>
      ) : null}

      <div className={cn("mt-auto", !current && "pt-2")}>
        <NavLink
          href="/settings"
          active={pathname === "/settings"}
          onNavigate={onNavigate}
        >
          <Settings className="size-4 shrink-0" />
          Settings
        </NavLink>
      </div>
    </nav>
  );
}

function HomeButton({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Home"
      aria-current={pathname === "/home" ? "page" : undefined}
      className={cn(pathname === "/home" && "bg-muted")}
      render={<Link href="/home" onClick={onNavigate} />}
    >
      <Home />
    </Button>
  );
}

function NavLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
