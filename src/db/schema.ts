import {
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
    estimatedMinutes: integer("estimated_minutes"),
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
    estimatedMinutes: integer("estimated_minutes"),
    frequency: frequency("frequency").notNull().default("daily"),
    /** Repeat every N days/weeks/months, depending on `frequency`. */
    interval: integer("interval").notNull().default(1),
    /** ISO weekdays (1 = Monday) for weekly routines. */
    byWeekday: integer("by_weekday").array(),
    /** Day of month (1–31) for monthly routines. */
    byMonthDay: integer("by_month_day"),
    /** Local time of day as HH:MM. */
    timeOfDay: text("time_of_day"),
    startDate: date("start_date").notNull(),
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

export type List = typeof list.$inferSelect;
export type Task = typeof task.$inferSelect;
export type TaskStep = typeof taskStep.$inferSelect;
export type Routine = typeof routine.$inferSelect;
export type Priority = (typeof priority.enumValues)[number];
export type Frequency = (typeof frequency.enumValues)[number];
