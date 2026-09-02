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
import { authClient } from "@/lib/auth-client";
import type { CalendarStatus } from "@/lib/types";

export function CalendarConnection({ status }: { status: CalendarStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function connect() {
    setPending(true);
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: "/settings",
    });
    if (error) {
      setPending(false);
      toast.error(error.message ?? "Couldn't reach Google.");
    }
  }

  async function disconnect() {
    setPending(true);
    const response = await fetch("/api/calendar", { method: "DELETE" });
    setPending(false);

    if (!response.ok) {
      toast.error("Couldn't disconnect that account.");
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Google Calendar</CardTitle>
        <CardDescription>
          {status.connected
            ? "Today's meetings appear at the top of My Day."
            : "Bring your meetings into My Day. Simon only reads your calendar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {!status.configured ? (
          <p className="text-muted-foreground text-sm">
            Google sign-in isn&apos;t set up on this server yet.
          </p>
        ) : status.connected ? (
          <>
            <span className="text-sm">
              {status.hasCalendarAccess
                ? "Connected"
                : "Connected, but calendar access wasn't granted"}
            </span>
            {status.hasCalendarAccess ? null : (
              <Button onClick={connect} disabled={pending}>
                Grant calendar access
              </Button>
            )}
            <Button variant="outline" onClick={disconnect} disabled={pending}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={connect} disabled={pending}>
            Connect Google Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
