import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { currentKeyOwner } from "@/lib/key-scope";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUserId() {
  const owner = currentKeyOwner();
  if (owner) return owner.userId;
  const session = await getSession();
  return session?.user.id ?? null;
}
