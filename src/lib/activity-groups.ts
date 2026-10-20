import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import {
  type ActivityGroupKind,
  activityGroup,
  activityGroupMember,
} from "@/db/schema";
import { sameIds } from "@/lib/time-sections";
import type { ActivityGroupItem } from "@/lib/types";

export function serializeGroup(
  row: typeof activityGroup.$inferSelect,
  members: ActivityGroupItem["members"] = [],
): ActivityGroupItem {
  return {
    id: row.id,
    kind: row.kind,
    activityId: row.activityId,
    name: row.name,
    emoji: row.emoji,
    members,
  };
}

export async function getActivityGroups(
  userId: string,
  kind: ActivityGroupKind,
): Promise<ActivityGroupItem[]> {
  const [groups, members] = await Promise.all([
    db
      .select()
      .from(activityGroup)
      .where(
        and(eq(activityGroup.userId, userId), eq(activityGroup.kind, kind)),
      )
      .orderBy(asc(activityGroup.position), asc(activityGroup.createdAt)),
    db
      .select()
      .from(activityGroupMember)
      .where(eq(activityGroupMember.userId, userId))
      .orderBy(
        asc(activityGroupMember.position),
        asc(activityGroupMember.createdAt),
      ),
  ]);

  return groups.map((group) =>
    serializeGroup(
      group,
      members
        .filter((member) => member.groupId === group.id)
        .map(({ id, activityId }) => ({ id, activityId })),
    ),
  );
}

export async function findGroup(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(activityGroup)
    .where(and(eq(activityGroup.id, id), eq(activityGroup.userId, userId)));
  return row ?? null;
}

export async function nextGroupPosition(
  userId: string,
  kind: ActivityGroupKind,
): Promise<number> {
  const [row] = await db
    .select({ value: max(activityGroup.position) })
    .from(activityGroup)
    .where(and(eq(activityGroup.userId, userId), eq(activityGroup.kind, kind)));
  return (row?.value ?? -1) + 1;
}

export async function nextMemberPosition(groupId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(activityGroupMember.position) })
    .from(activityGroupMember)
    .where(eq(activityGroupMember.groupId, groupId));
  return (row?.value ?? -1) + 1;
}

export async function reorderGroups(
  userId: string,
  kind: ActivityGroupKind,
  ids: string[],
): Promise<boolean> {
  const rows = await db
    .select({ id: activityGroup.id })
    .from(activityGroup)
    .where(and(eq(activityGroup.userId, userId), eq(activityGroup.kind, kind)));
  if (!sameIds(rows, ids)) return false;

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(activityGroup)
        .set({ position: index, updatedAt: new Date() })
        .where(and(eq(activityGroup.id, id), eq(activityGroup.userId, userId)));
    }
  });
  return true;
}

export async function reorderMembers(
  userId: string,
  groupId: string,
  ids: string[],
): Promise<boolean> {
  const rows = await db
    .select({ id: activityGroupMember.id })
    .from(activityGroupMember)
    .where(
      and(
        eq(activityGroupMember.groupId, groupId),
        eq(activityGroupMember.userId, userId),
      ),
    );
  if (!sameIds(rows, ids)) return false;

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(activityGroupMember)
        .set({ position: index })
        .where(
          and(
            eq(activityGroupMember.id, id),
            eq(activityGroupMember.userId, userId),
          ),
        );
    }
  });
  return true;
}
