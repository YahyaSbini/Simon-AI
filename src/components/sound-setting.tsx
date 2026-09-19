"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSoundMuted, playCompleteSound, setSoundMuted } from "@/lib/sound";

export function SoundSetting() {
  const [muted, setMuted] = useState<boolean | null>(null);

  useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
    if (!next) playCompleteSound();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Completion sound</CardTitle>
        <CardDescription>
          A short chime when you tick something off. Saved on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={toggle}
          disabled={muted === null}
          aria-pressed={muted === false}
        >
          {muted ? "Turn sound on" : "Turn sound off"}
        </Button>
        <p className="text-muted-foreground text-sm">
          {muted === null ? "" : muted ? "Sound is off." : "Sound is on."}
        </p>
      </CardContent>
    </Card>
  );
}
