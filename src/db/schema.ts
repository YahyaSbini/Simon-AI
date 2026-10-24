import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    uniqueIndex("account_issuer_account_id_idx").on(t.issuer, t.accountId),
  ],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const priority = pgEnum("priority", ["none", "low", "medium", "high"]);

export const list = pgTable(
  "list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("list_user_id_idx").on(t.userId)],
);

export const taskType = pgEnum("task_type", [
  "dependent",
  "independent",
  "hybrid",
]);

export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => list.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: priority("priority").notNull().default("none"),
    important: boolean("important").notNull().default(false),
    estimatedMinutes: integer("estimated_minutes").notNull().default(15),
    type: taskType("type").notNull().default("independent"),
    /** Dependent/hybrid tasks hang under another task, an activity, or both. */
    parentTaskId: uuid("parent_task_id").references(
      (): AnyPgColumn => task.id,
      {
        onDelete: "set null",
      },
    ),
    activityId: uuid("activity_id").references((): AnyPgColumn => activity.id, {
      onDelete: "set null",
    }),
    dueAt: timestamp("due_at"),
    myDayDate: date("my_day_date"),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("task_user_id_idx").on(t.userId),
    index("task_list_id_idx").on(t.listId),
  ],
);

export const taskStep = pgTable(
  "task_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    completedAt: timestamp("completed_at"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("task_step_task_id_idx").on(t.taskId)],
);

export const frequency = pgEnum("frequency", ["daily", "weekly", "monthly"]);

export const routine = pgTable(
  "routine",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: priority("priority").notNull().default("none"),
    important: boolean("important").notNull().default(false),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    type: taskType("type").notNull().default("independent"),
    /** Dependent/hybrid routines hang under another routine, an activity, or both. */
    parentRoutineId: uuid("parent_routine_id").references(
      (): AnyPgColumn => routine.id,
      { onDelete: "set null" },
    ),
    activityId: uuid("activity_id").references((): AnyPgColumn => activity.id, {
      onDelete: "set null",
    }),
    frequency: frequency("frequency").notNull().default("daily"),
    /** Repeat every N days/weeks/months, depending on `frequency`. */
    interval: integer("interval").notNull().default(1),
    /** ISO weekdays (1 = Monday) for weekly routines. */
    byWeekday: integer("by_weekday").array(),
    /** Day of month (1–31) for monthly routines. */
    byMonthDay: integer("by_month_day"),
    /** ISO weekday for "last <weekday> of the month"; overrides `byMonthDay`. */
    byLastWeekday: integer("by_last_weekday"),
    /** Local time of day as HH:MM. */
    timeOfDay: text("time_of_day"),
    startDate: date("start_date").notNull(),
    /** Last day the routine repeats, inclusive. */
    endDate: date("end_date"),
    /** Missed days stay in My Day (overdue) until ticked instead of vanishing. */
    carryOver: boolean("carry_over").notNull().default(false),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("routine_user_id_idx").on(t.userId)],
);

export const routineCompletion = pgTable(
  "routine_completion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routine.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("routine_completion_routine_date_idx").on(t.routineId, t.date),
  ],
);

export const routineStep = pgTable(
  "routine_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routine.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("routine_step_routine_id_idx").on(t.routineId)],
);

/** A routine step ticked on a given day; steps reset with each occurrence. */
export const routineStepCompletion = pgTable(
  "routine_step_completion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stepId: uuid("step_id")
      .notNull()
      .references(() => routineStep.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("routine_step_completion_step_date_idx").on(t.stepId, t.date),
  ],
);

/** A Google Calendar event the user ticked off in My Day. */
export const calendarEventCompletion = pgTable(
  "calendar_event_completion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    /** Local agenda day the event was ticked on (multiday events are ticked per day). */
    date: date("date").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("calendar_event_completion_user_event_date_idx").on(
      t.userId,
      t.eventId,
      t.date,
    ),
  ],
);

/** A block of the user's standard week: "10:00–11:00 Work" on the given weekdays. */
/** A reusable kind of block, e.g. Sleep or Work; day blocks are placed from these. */
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji"),
    color: text("color"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("activity_user_id_idx").on(t.userId)],
);

export const activityGroupKind = pgEnum("activity_group_kind", [
  "investment",
  "hobby",
]);

/**
 * A list of activities: an "investment" is anchored to one main activity
 * (things to do during it); a "hobby" is a named category.
 */
export const activityGroup = pgTable(
  "activity_group",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: activityGroupKind("kind").notNull(),
    activityId: uuid("activity_id").references(() => activity.id, {
      onDelete: "cascade",
    }),
    name: text("name"),
    emoji: text("emoji"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_group_user_kind_idx").on(t.userId, t.kind),
    uniqueIndex("activity_group_activity_idx").on(t.activityId),
  ],
);

export const activityGroupMember = pgTable(
  "activity_group_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => activityGroup.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activity.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("activity_group_member_unique_idx").on(t.groupId, t.activityId),
  ],
);

export const dayBlock = pgTable(
  "day_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** ISO weekdays (1 = Monday) this block applies to. */
    weekdays: integer("weekdays").array().notNull(),
    /** Local time as HH:MM; `end` before `start` means the block runs overnight. */
    start: text("start").notNull(),
    end: text("end").notNull(),
    /** May be empty when the block is shown by its emoji alone. */
    label: text("label").notNull(),
    emoji: text("emoji"),
    color: text("color"),
    /** Label, emoji and color are copied from this activity and kept in sync. */
    activityId: uuid("activity_id").references(() => activity.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("day_block_user_id_idx").on(t.userId),
    index("day_block_activity_id_idx").on(t.activityId),
  ],
);

/** A user-named group of time rules, e.g. "Constraints" or "Rules". */
export const timeSection = pgTable(
  "time_section",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    collapsed: boolean("collapsed").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("time_section_user_id_idx").on(t.userId)],
);

export const timeSectionItem = pgTable(
  "time_section_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => timeSection.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("time_section_item_section_id_idx").on(t.sectionId)],
);

export const entryKind = pgEnum("entry_kind", ["income", "expense"]);

export const financeSettings = pgTable("finance_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const financeCategory = pgTable(
  "finance_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: entryKind("kind").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("finance_category_user_id_idx").on(t.userId)],
);

/** A monthly budget line: a fixed bill when `dueDay` is set, otherwise a spending limit. */
export const budgetItem = pgTable(
  "budget_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => financeCategory.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** Day of month (1–31) the bill posts itself as an expense. */
    dueDay: integer("due_day"),
    startDate: date("start_date").notNull(),
    /** Last day auto-posting has run for; later due dates are still pending. */
    postedThrough: date("posted_through"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("budget_item_user_id_idx").on(t.userId)],
);

export const financeEntry = pgTable(
  "finance_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: entryKind("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    categoryId: uuid("category_id").references(() => financeCategory.id, {
      onDelete: "set null",
    }),
    /** Set when the entry was posted automatically by a budget bill. */
    budgetItemId: uuid("budget_item_id").references(() => budgetItem.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    note: text("note"),
    /** Income still to receive or a payment still to make; left out of totals. */
    expected: boolean("expected").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("finance_entry_user_date_idx").on(t.userId, t.date),
    index("finance_entry_budget_item_idx").on(t.budgetItemId),
  ],
);

export const savingsGoal = pgTable(
  "savings_goal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetCents: integer("target_cents").notNull(),
    savedCents: integer("saved_cents").notNull().default(0),
    targetDate: date("target_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("savings_goal_user_id_idx").on(t.userId)],
);

export type List = typeof list.$inferSelect;
export type DayBlock = typeof dayBlock.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type ActivityGroup = typeof activityGroup.$inferSelect;
export type ActivityGroupKind = (typeof activityGroupKind.enumValues)[number];
export type TimeSection = typeof timeSection.$inferSelect;
export type TimeSectionItemRow = typeof timeSectionItem.$inferSelect;
export type Task = typeof task.$inferSelect;
export type TaskStep = typeof taskStep.$inferSelect;
export type Routine = typeof routine.$inferSelect;
export type RoutineStep = typeof routineStep.$inferSelect;
export type Priority = (typeof priority.enumValues)[number];
export type Frequency = (typeof frequency.enumValues)[number];
export type TaskType = (typeof taskType.enumValues)[number];
export type FinanceCategory = typeof financeCategory.$inferSelect;
export type BudgetItem = typeof budgetItem.$inferSelect;
export type FinanceEntry = typeof financeEntry.$inferSelect;
export type SavingsGoal = typeof savingsGoal.$inferSelect;
export type EntryKind = (typeof entryKind.enumValues)[number];
