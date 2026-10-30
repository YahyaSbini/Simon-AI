// Fills values that new NOT NULL columns require, so `drizzle-kit push` can apply them.
import { existsSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL && existsSync(".env"))
  process.loadEnvFile(".env");

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  for (const table of ["task", "routine"]) {
    await sql`update ${sql(table)} set estimated_minutes = 15 where estimated_minutes is null`.catch(
      (error) => {
        if (error.code !== "42P01") throw error;
      },
    );
  }
  // Budget items now belong to the month they start in. Older bills whose first
  // due date fell before their start date really began the next month.
  await sql`
    update budget_item
    set start_date = (date_trunc('month', start_date) + interval '1 month')::date
    where due_day is not null
      and extract(day from start_date) > least(
        due_day,
        extract(day from date_trunc('month', start_date) + interval '1 month - 1 day')
      )`.catch((error) => {
    if (error.code !== "42P01") throw error;
  });
} finally {
  await sql.end();
}
