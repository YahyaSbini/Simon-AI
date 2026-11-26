"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
import type { ApiKeyItem } from "@/lib/api-keys";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button variant="outline" size="icon" onClick={copy} aria-label={label}>
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AiAccess({ initialKeys }: { initialKeys: ApiKeyItem[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("/api/mcp");

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/mcp`);
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const response = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    setPending(false);

    if (!response.ok) {
      toast.error("Couldn't create that key.");
      return;
    }

    const { key, item } = await response.json();
    setKeys((current) => [item, ...current]);
    setNewKey(key);
    setName("");
  }

  async function remove(id: string) {
    const response = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Couldn't delete that key.");
      return;
    }

    setKeys((current) => current.filter((key) => key.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">AI access</CardTitle>
        <CardDescription>
          Let an assistant like Manus read and change your tasks, routines, time
          and finance. Add Simon to it as an MCP server with this URL and a key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mcp-url">MCP server URL</Label>
          <div className="flex gap-2">
            <Input id="mcp-url" readOnly value={endpoint} className="font-mono" />
            <CopyButton value={endpoint} label="Copy URL" />
          </div>
          <p className="text-muted-foreground text-sm">
            Send the key as <code>Authorization: Bearer &lt;key&gt;</code>. If the
            assistant only takes a URL, use <code>{endpoint}?key=&lt;key&gt;</code>.
          </p>
        </div>

        <form onSubmit={create} className="space-y-2">
          <Label htmlFor="key-name">New key</Label>
          <div className="flex gap-2">
            <Input
              id="key-name"
              placeholder="Manus"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
            />
            <Button type="submit" disabled={pending || !name.trim()}>
              Create key
            </Button>
          </div>
        </form>

        {newKey ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm">
              Copy this key now. It won&apos;t be shown again.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={newKey} className="font-mono" />
              <CopyButton value={newKey} label="Copy key" />
            </div>
          </div>
        ) : null}

        {keys.length ? (
          <ul className="space-y-2">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{key.name}</p>
                  <p className="text-muted-foreground text-sm">
                    <span className="font-mono">{key.preview}…</span> · created{" "}
                    {formatDate(key.createdAt)} ·{" "}
                    {key.lastUsedAt
                      ? `last used ${formatDate(key.lastUsedAt)}`
                      : "never used"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(key.id)}
                  aria-label={`Delete ${key.name}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No keys yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
