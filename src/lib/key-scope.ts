import { AsyncLocalStorage } from "node:async_hooks";
import type { ApiKeyOwner } from "@/lib/api-keys";

/** The key owner an API key request (the MCP endpoint) acts for. */
const scope = new AsyncLocalStorage<ApiKeyOwner>();

export function runWithKey<T>(owner: ApiKeyOwner, run: () => T): T {
  return scope.run(owner, run);
}

export function currentKeyOwner(): ApiKeyOwner | undefined {
  return scope.getStore();
}
