"use client";

import { useState } from "react";
import { toast } from "sonner";
import { selectClass } from "@/components/task-detail";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currencies } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CurrencySetting({ initial }: { initial: string }) {
  const [currency, setCurrency] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const previous = currency;
    setCurrency(next);
    setSaving(true);
    const response = await fetch("/api/finance/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: next }),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Couldn't change the currency.");
      setCurrency(previous);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Currency</CardTitle>
        <CardDescription>
          Used for every amount in Financial Management. Changing it relabels
          amounts; it doesn&apos;t convert them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <select
          value={currency}
          onChange={(event) => change(event.target.value)}
          disabled={saving}
          aria-label="Currency"
          className={cn(selectClass, "w-64")}
        >
          {currencies.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} · {item.label}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
}
