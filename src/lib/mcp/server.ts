import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as activityRoute from "@/app/api/activities/[id]/route";
import * as activitiesRoute from "@/app/api/activities/route";
import * as dayBlockRoute from "@/app/api/day-blocks/[id]/route";
import * as dayBlocksRoute from "@/app/api/day-blocks/route";
import * as budgetItemRoute from "@/app/api/finance/budget-items/[id]/route";
import * as budgetItemsRoute from "@/app/api/finance/budget-items/route";
import * as categoryRoute from "@/app/api/finance/categories/[id]/route";
import * as categoriesRoute from "@/app/api/finance/categories/route";
import * as entryRoute from "@/app/api/finance/entries/[id]/route";
import * as entriesRoute from "@/app/api/finance/entries/route";
import * as goalRoute from "@/app/api/finance/goals/[id]/route";
import * as goalsRoute from "@/app/api/finance/goals/route";
import * as moneyItemRoute from "@/app/api/finance/items/[id]/route";
import * as moneyItemsRoute from "@/app/api/finance/items/route";
import * as listRoute from "@/app/api/lists/[id]/route";
import * as listsRoute from "@/app/api/lists/route";
import * as routineStepRoute from "@/app/api/routine-steps/[id]/route";
import * as routineCompletionRoute from "@/app/api/routines/[id]/completion/route";
import * as routineRoute from "@/app/api/routines/[id]/route";
import * as routineStepsRoute from "@/app/api/routines/[id]/steps/route";
import * as routinesRoute from "@/app/api/routines/route";
import * as searchRoute from "@/app/api/search/route";
import * as stepRoute from "@/app/api/steps/[id]/route";
import * as taskRoute from "@/app/api/tasks/[id]/route";
import * as taskStepsRoute from "@/app/api/tasks/[id]/steps/route";
import * as tasksRoute from "@/app/api/tasks/route";
import type { ApiKeyOwner } from "@/lib/api-keys";
import { monthTotals } from "@/lib/budget";
import { getCalendarAgenda } from "@/lib/calendar";
import {
  getActivities,
  getDayBlocks,
  getLists,
  getMyDayTasks,
  getRoutineOccurrences,
  getRoutines,
  getTasks,
} from "@/lib/data";
import {
  getBudgetItems,
  getBudgetYearSummary,
  getCategories,
  getFinanceMonth,
  getSavingsGoals,
  getYearSummary,
} from "@/lib/finance";
import { monthOf } from "@/lib/money";
import { getMoneyItems } from "@/lib/money-items";
import { todayIn } from "@/lib/timezone";
import {
  activityInput,
  activityUpdate,
  budgetItemInput,
  budgetItemUpdate,
  budgetPickInput,
  categoryInput,
  dayBlockInput,
  dayBlockUpdate,
  entryInput,
  moneyItemInput,
  moneyItemUpdate,
  routineInput,
  routineUpdate,
  savingsGoalInput,
} from "@/lib/validation";

const instructions = `Simon is Yahya's personal planner: tasks, lists, routines, My Day, time blocks and finance.
Conventions:
- Dates are YYYY-MM-DD, months are YYYY-MM, times are HH:MM (24h). Leave out "date" to mean today in the user's time zone.
- Weekdays are ISO numbers: 1 = Monday ... 6 = Saturday, 7 = Sunday. The user's week starts on Saturday.
- Money is AED only, in integer cents: 150 AED = 15000.
- Task and routine "type": "independent" stands alone, "dependent" needs a parentTaskId/parentRoutineId, "hybrid" may have one. activityId links it to an activity.
- Finance: In/Out Items (money items) are recurring templates that create real entries each month. Budget items are planning only and never create entries. Entries with expected = true are not counted as received or paid yet.
- Read before you change: look up ids with the list_* / get_* tools. Updates only change the fields you pass.`;

type RouteHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

type Result = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function json(data: unknown): Result {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/** Runs an existing API route handler so tools share its validation and rules. */
async function callRoute(
  handler: RouteHandler,
  options: {
    method: string;
    id?: string;
    body?: unknown;
    query?: Record<string, string>;
  },
): Promise<Result> {
  const url = new URL("http://simon.local/api");
  for (const [name, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(name, value);
  }
  const response = await handler(
    new Request(url, {
      method: options.method,
      headers: { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    { params: Promise.resolve({ id: options.id ?? "" }) },
  );
  if (response.status === 204) return json({ ok: true });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      content: [
        {
          type: "text",
          text: `Error ${response.status}: ${data?.error ?? response.statusText}`,
        },
      ],
      isError: true,
    };
  }
  return json(data);
}

const id = z.string().uuid();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);
const priority = z.enum(["none", "low", "medium", "high"]);
const taskType = z.enum(["dependent", "independent", "hybrid"]);

const taskFields = {
  notes: z.string().max(2000).nullish(),
  listId: id.nullish().describe("List id; null for no list"),
  priority: priority.optional(),
  parentTaskId: id.nullish(),
  activityId: id.nullish(),
  countInTime: z.boolean().optional(),
  dueAt: z.string().nullish().describe("ISO date-time the task is due"),
  myDayDate: dateKey.nullish().describe("Show on My Day for this date"),
  later: z.boolean().optional().describe("Park the task on the Later page"),
};

const readOnly = { readOnlyHint: true };
const destructive = { destructiveHint: true };

export function createSimonServer(owner: ApiKeyOwner): McpServer {
  const server = new McpServer(
    { name: "simon", version: "1.0.0" },
    { instructions },
  );
  const { userId } = owner;
  const today = () => todayIn(owner.timeZone);

  // My Day, lists and tasks

  server.registerTool(
    "get_my_day",
    {
      description:
        "My Day for a date: open tasks flagged for it or due by it, routine occurrences (with carried-over ones) and Google Calendar events.",
      inputSchema: { date: dateKey.optional() },
      annotations: readOnly,
    },
    async ({ date }) => {
      const day = date ?? today();
      const [tasks, routines, calendar] = await Promise.all([
        getMyDayTasks(userId, day),
        getRoutineOccurrences(userId, day),
        getCalendarAgenda(userId, day, owner.timeZone).catch(() => null),
      ]);
      return json({ date: day, tasks, routines, calendar });
    },
  );

  server.registerTool(
    "search",
    {
      description: "Search tasks (open, Later and completed) and routines by text.",
      inputSchema: { query: z.string().min(1) },
      annotations: readOnly,
    },
    ({ query }) => callRoute(searchRoute.GET, { method: "GET", query: { q: query } }),
  );

  server.registerTool(
    "list_lists",
    { description: "All task lists.", annotations: readOnly },
    async () => json({ lists: await getLists(userId) }),
  );

  server.registerTool(
    "create_list",
    {
      description: "Create a task list.",
      inputSchema: { name: z.string().min(1).max(80) },
    },
    (body) => callRoute(listsRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "rename_list",
    {
      description: "Rename a task list.",
      inputSchema: { id, name: z.string().min(1).max(80) },
    },
    ({ id, ...body }) => callRoute(listRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_list",
    {
      description: "Delete a task list.",
      inputSchema: { id },
      annotations: destructive,
    },
    ({ id }) => callRoute(listRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "list_tasks",
    {
      description:
        "Tasks with their steps. view: all (open, not Later), important, planned (has a due date), later, completed, list (needs listId).",
      inputSchema: {
        view: z
          .enum(["all", "important", "planned", "later", "completed", "list"])
          .default("all"),
        listId: id.optional(),
      },
      annotations: readOnly,
    },
    async ({ view, listId }) => {
      if (view === "list" && !listId) {
        return {
          content: [{ type: "text", text: 'view "list" needs a listId.' }],
          isError: true,
        };
      }
      return json({ tasks: await getTasks(userId, view, { listId }) });
    },
  );

  server.registerTool(
    "create_task",
    {
      description: "Create a task. estimatedMinutes (1-1440) and type are required.",
      inputSchema: {
        title: z.string().min(1).max(200),
        estimatedMinutes: z.number().int().min(1).max(1440),
        type: taskType,
        ...taskFields,
      },
    },
    (body) => callRoute(tasksRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_task",
    {
      description:
        "Change a task. Only the fields you pass change. completed: true ticks it, false reopens it.",
      inputSchema: {
        id,
        title: z.string().min(1).max(200).optional(),
        estimatedMinutes: z.number().int().min(1).max(1440).optional(),
        type: taskType.optional(),
        important: z.boolean().optional(),
        completed: z.boolean().optional(),
        ...taskFields,
      },
    },
    ({ id, ...body }) => callRoute(taskRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_task",
    { description: "Delete a task.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(taskRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "add_task_step",
    {
      description: "Add a step (checklist item) to a task.",
      inputSchema: { taskId: id, title: z.string().min(1).max(200) },
    },
    ({ taskId, title }) =>
      callRoute(taskStepsRoute.POST, { method: "POST", id: taskId, body: { title } }),
  );

  server.registerTool(
    "update_task_step",
    {
      description: "Rename, add notes to, or tick a task step.",
      inputSchema: {
        id,
        title: z.string().min(1).max(200).optional(),
        notes: z.string().max(2000).nullish(),
        completed: z.boolean().optional(),
      },
    },
    ({ id, ...body }) => callRoute(stepRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_task_step",
    { description: "Delete a task step.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(stepRoute.DELETE, { method: "DELETE", id }),
  );

  // Routines

  server.registerTool(
    "list_routines",
    {
      description: "All routines, with step state for the given date.",
      inputSchema: { date: dateKey.optional() },
      annotations: readOnly,
    },
    async ({ date }) => json({ routines: await getRoutines(userId, date ?? today()) }),
  );

  server.registerTool(
    "create_routine",
    {
      description:
        "Create a routine. frequency daily/weekly/monthly with interval (every N). Weekly uses byWeekday; monthly uses byMonthDay, or byLastWeekday (1-7 = last such weekday, 0 = last day of the month). timeOfDay HH:MM is required by the app.",
      inputSchema: routineInput.shape,
    },
    (body) => callRoute(routinesRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_routine",
    {
      description: "Change a routine. Only the fields you pass change. active: false pauses it.",
      inputSchema: { id, ...routineUpdate.shape },
    },
    ({ id, ...body }) => callRoute(routineRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_routine",
    { description: "Delete a routine.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(routineRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "set_routine_done",
    {
      description: "Tick (done: true) or untick a routine's occurrence on a date.",
      inputSchema: { id, date: dateKey.optional(), done: z.boolean() },
    },
    ({ id, date, done }) => {
      const day = date ?? today();
      return done
        ? callRoute(routineCompletionRoute.POST, { method: "POST", id, body: { date: day } })
        : callRoute(routineCompletionRoute.DELETE, {
            method: "DELETE",
            id,
            query: { date: day },
          });
    },
  );

  server.registerTool(
    "add_routine_step",
    {
      description: "Add a step to a routine. Steps reset with each occurrence.",
      inputSchema: { routineId: id, title: z.string().min(1).max(200) },
    },
    ({ routineId, title }) =>
      callRoute(routineStepsRoute.POST, {
        method: "POST",
        id: routineId,
        body: { title },
      }),
  );

  server.registerTool(
    "update_routine_step",
    {
      description:
        "Rename a routine step, or tick it for a date (completed + date; date defaults to today).",
      inputSchema: {
        id,
        title: z.string().min(1).max(200).optional(),
        notes: z.string().max(2000).nullish(),
        completed: z.boolean().optional(),
        date: dateKey.optional(),
      },
    },
    ({ id, ...body }) =>
      callRoute(routineStepRoute.PATCH, {
        method: "PATCH",
        id,
        body:
          body.completed === undefined ? body : { ...body, date: body.date ?? today() },
      }),
  );

  server.registerTool(
    "delete_routine_step",
    {
      description: "Delete a routine step.",
      inputSchema: { id },
      annotations: destructive,
    },
    ({ id }) => callRoute(routineStepRoute.DELETE, { method: "DELETE", id }),
  );

  // Time: activities and weekly day blocks

  server.registerTool(
    "list_activities",
    { description: "Activities (kinds of time use) that day blocks and tasks link to.", annotations: readOnly },
    async () => json({ activities: await getActivities(userId) }),
  );

  server.registerTool(
    "create_activity",
    { description: "Create an activity.", inputSchema: activityInput.shape },
    (body) => callRoute(activitiesRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_activity",
    { description: "Change an activity.", inputSchema: { id, ...activityUpdate.shape } },
    ({ id, ...body }) => callRoute(activityRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_activity",
    {
      description: "Delete an activity. Fails while day blocks use it.",
      inputSchema: { id },
      annotations: destructive,
    },
    ({ id }) => callRoute(activityRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "list_day_blocks",
    { description: "The weekly time-block schedule.", annotations: readOnly },
    async () => json({ blocks: await getDayBlocks(userId) }),
  );

  server.registerTool(
    "create_day_block",
    {
      description: "Add a weekly time block (start/end HH:MM) on the given weekdays.",
      inputSchema: dayBlockInput.shape,
    },
    (body) => callRoute(dayBlocksRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_day_block",
    { description: "Change a time block.", inputSchema: { id, ...dayBlockUpdate.shape } },
    ({ id, ...body }) => callRoute(dayBlockRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_day_block",
    { description: "Delete a time block.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(dayBlockRoute.DELETE, { method: "DELETE", id }),
  );

  // Finance

  server.registerTool(
    "get_finance_month",
    {
      description:
        "A month's entries, totals (received/paid and expected, in cents), budget plan items and categories.",
      inputSchema: { month: monthKey.optional() },
      annotations: readOnly,
    },
    async ({ month }) => {
      const key = month ?? monthOf(today());
      const [{ categories, entries }, budget] = await Promise.all([
        getFinanceMonth(userId, key, today()),
        getBudgetItems(userId, key),
      ]);
      return json({ month: key, totals: monthTotals(entries), entries, budget, categories });
    },
  );

  server.registerTool(
    "get_finance_year",
    {
      description:
        "Per-month totals for a year: actual (settled entries) and planned (budget), in cents.",
      inputSchema: { year: z.number().int().min(2000).max(2999).optional() },
      annotations: readOnly,
    },
    async ({ year }) => {
      const target = year ?? Number(today().slice(0, 4));
      const [actual, planned] = await Promise.all([
        getYearSummary(userId, target, today()),
        getBudgetYearSummary(userId, target),
      ]);
      return json({ year: target, actual, planned });
    },
  );

  server.registerTool(
    "list_finance_categories",
    { description: "Income and expense categories.", annotations: readOnly },
    async () => json({ categories: await getCategories(userId) }),
  );

  server.registerTool(
    "create_finance_category",
    { description: "Create an income or expense category.", inputSchema: categoryInput.shape },
    (body) => callRoute(categoriesRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "rename_finance_category",
    {
      description: "Rename a category.",
      inputSchema: { id, name: categoryInput.shape.name },
    },
    ({ id, ...body }) => callRoute(categoryRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_finance_category",
    { description: "Delete a category.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(categoryRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "create_finance_entry",
    {
      description:
        "Record income or an expense (amountCents, AED). expected: true for money not yet received or paid.",
      inputSchema: entryInput.shape,
    },
    (body) => callRoute(entriesRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_finance_entry",
    {
      description: "Change an entry; set expected: false once it's settled.",
      inputSchema: { id, ...entryInput.partial().shape },
    },
    ({ id, ...body }) => callRoute(entryRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_finance_entry",
    { description: "Delete an entry.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(entryRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "list_money_items",
    { description: "In/Out Items: recurring income and outcome templates.", annotations: readOnly },
    async () => json({ items: await getMoneyItems(userId) }),
  );

  server.registerTool(
    "create_money_item",
    {
      description:
        "Create an In/Out Item. It adds a real entry on `day` of each month from startMonth (12 months ahead) if repeats, else once.",
      inputSchema: moneyItemInput.shape,
    },
    (body) => callRoute(moneyItemsRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_money_item",
    {
      description:
        "Change an In/Out Item. Name, category and day apply to all months; a new amount applies from next month on.",
      inputSchema: { id, ...moneyItemUpdate.shape },
    },
    ({ id, ...body }) => callRoute(moneyItemRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_money_item",
    {
      description: "Delete an In/Out Item and its future entries.",
      inputSchema: { id },
      annotations: destructive,
    },
    ({ id }) => callRoute(moneyItemRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "add_budget_item",
    {
      description: "Add a planned income or outcome to a month's budget by hand.",
      inputSchema: budgetItemInput.shape,
    },
    (body) => callRoute(budgetItemsRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "add_budget_items_from_money_items",
    {
      description: "Copy In/Out Items into a month's budget.",
      inputSchema: budgetPickInput.shape,
    },
    (body) => callRoute(budgetItemsRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_budget_item",
    {
      description: "Change a budget plan item.",
      inputSchema: { id, ...budgetItemUpdate.shape },
    },
    ({ id, ...body }) => callRoute(budgetItemRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_budget_item",
    { description: "Delete a budget plan item.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(budgetItemRoute.DELETE, { method: "DELETE", id }),
  );

  server.registerTool(
    "list_savings_goals",
    { description: "Savings goals.", annotations: readOnly },
    async () => json({ goals: await getSavingsGoals(userId) }),
  );

  server.registerTool(
    "create_savings_goal",
    { description: "Create a savings goal.", inputSchema: savingsGoalInput.shape },
    (body) => callRoute(goalsRoute.POST, { method: "POST", body }),
  );

  server.registerTool(
    "update_savings_goal",
    {
      description: "Change a savings goal, e.g. savedCents.",
      inputSchema: { id, ...savingsGoalInput.partial().shape },
    },
    ({ id, ...body }) => callRoute(goalRoute.PATCH, { method: "PATCH", id, body }),
  );

  server.registerTool(
    "delete_savings_goal",
    { description: "Delete a savings goal.", inputSchema: { id }, annotations: destructive },
    ({ id }) => callRoute(goalRoute.DELETE, { method: "DELETE", id }),
  );

  return server;
}
