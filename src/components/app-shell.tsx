"use client";

import {
  CalendarClock,
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
import { SignOutButton } from "@/components/sign-out-button";
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

const views = [
  { href: "/my-day", label: "My Day", icon: Sun },
  { href: "/important", label: "Important", icon: Star },
  { href: "/planned", label: "Planned", icon: CalendarClock },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/routines", label: "Routines", icon: Repeat },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  lists,
  children,
}: {
  lists: ListItem[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border hidden w-64 shrink-0 flex-col gap-6 border-r px-4 py-6 md:flex">
        <BrandMark />
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
              <SheetHeader className="p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <BrandMark />
              </SheetHeader>
              <Nav lists={lists} onNavigate={() => setOpen(false)} />
              <SignOutButton />
            </SheetContent>
          </Sheet>
          <BrandMark size={28} />
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8 md:py-10">
          {children}
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
      <ul className="space-y-0.5">
        {views.map((view) => (
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

        <form onSubmit={createList} className="flex items-center gap-1.5 px-1">
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
    </nav>
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
