"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const name = String(form.get("name") ?? "");

    setPending(true);

    const { error } =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name });

    setPending(false);

    if (error) {
      toast.error(error.message ?? "That didn't work. Check your details.");
      return;
    }

    router.push("/my-day");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {mode === "sign-in"
            ? "Sign in to pick up where you left off."
            : "A name, an email, a password — that's it."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "sign-up" ? (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              minLength={8}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {googleEnabled ? (
          <>
            <div className="my-4 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">or</span>
              <Separator className="flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const { error } = await signIn.social({
                  provider: "google",
                  callbackURL: "/my-day",
                });
                if (error) {
                  setPending(false);
                  toast.error(error.message ?? "Couldn't reach Google.");
                }
              }}
            >
              Continue with Google
            </Button>
          </>
        ) : null}

        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-4 w-full text-sm transition-colors"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        >
          {mode === "sign-in"
            ? "No account yet? Create one"
            : "Already have an account? Sign in"}
        </button>
      </CardContent>
    </Card>
  );
}
