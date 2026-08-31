import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect("/tasks");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <BrandMark />
        <Button variant="ghost" render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center gap-10 py-16 md:flex-row md:gap-16 md:py-24">
        <div className="max-w-md space-y-6">
          <h1 className="font-heading text-4xl leading-tight md:text-5xl">
            Your day, held together.
          </h1>
          <p className="text-muted-foreground text-lg">
            Simon keeps your tasks and your inbox in one place, so nothing slips
            between them.
          </p>
          <Button size="lg" render={<Link href="/sign-in" />}>
            Get your list going
          </Button>
        </div>

        <Image
          src="/logo.jpg"
          alt=""
          width={420}
          height={420}
          className="w-64 mix-blend-multiply md:w-96"
          priority
        />
      </div>
    </main>
  );
}
