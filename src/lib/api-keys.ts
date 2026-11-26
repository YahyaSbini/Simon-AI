import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKey } from "@/db/schema";

export type ApiKeyItem = {
  id: string;
  name: string;
  preview: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export type ApiKeyOwner = { userId: string; timeZone: string };

const prefix = "simon_";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function serializeApiKey(row: typeof apiKey.$inferSelect): ApiKeyItem {
  return {
    id: row.id,
    name: row.name,
    preview: row.preview,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getApiKeys(userId: string): Promise<ApiKeyItem[]> {
  const rows = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.userId, userId))
    .orderBy(desc(apiKey.createdAt));
  return rows.map(serializeApiKey);
}

/** Stores only the hash; the full key is returned once, here. */
export async function createApiKey(
  userId: string,
  name: string,
  timeZone: string,
): Promise<{ key: string; item: ApiKeyItem }> {
  const key = prefix + randomBytes(24).toString("base64url");
  const [row] = await db
    .insert(apiKey)
    .values({
      userId,
      name,
      timeZone,
      keyHash: hashKey(key),
      preview: key.slice(0, prefix.length + 4),
    })
    .returning();
  return { key, item: serializeApiKey(row) };
}

export async function deleteApiKey(userId: string, id: string) {
  const [deleted] = await db
    .delete(apiKey)
    .where(and(eq(apiKey.id, id), eq(apiKey.userId, userId)))
    .returning({ id: apiKey.id });
  return deleted;
}

/** The key from `Authorization: Bearer <key>`, or `?key=` for clients that can't set headers. */
const keyPattern = new RegExp(`${prefix}[A-Za-z0-9_-]+`);

/** Finds the key in Authorization (with or without "Bearer"), X-API-Key or ?key=. */
export function keyFromRequest(request: Request): string | null {
  const sources = [
    request.headers.get("authorization"),
    request.headers.get("x-api-key"),
    new URL(request.url).searchParams.get("key"),
  ];

  for (const source of sources) {
    const key = source?.match(keyPattern)?.[0];
    if (key) return key;
  }

  return null;
}

export async function findApiKeyOwner(
  key: string | null,
): Promise<ApiKeyOwner | null> {
  if (!key?.startsWith(prefix)) return null;
  const [row] = await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.keyHash, hashKey(key)))
    .returning({ userId: apiKey.userId, timeZone: apiKey.timeZone });
  return row ?? null;
}
