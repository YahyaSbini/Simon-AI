import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** The user an API key request (the MCP endpoint) acts for. */
const keyUser = new AsyncLocalStorage<string>();

export function runAsUser<T>(userId: string, run: () => T): T {
  return keyUser.run(userId, run);
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUserId() {
  const scoped = keyUser.getStore();
  if (scoped) return scoped;
  const session = await getSession();
  return session?.user.id ?? null;
}
