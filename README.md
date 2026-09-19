# Simon

A personal AI assistant for tasks and email. This stage covers auth, lists and tasks, routines,
a My Day view, and read-only Google Calendar.

## Views

- **My Day** — today's Google Calendar events, tasks (flagged for today or due), then a divider and today's routine occurrences, with remaining time.
- **Settings** — connect or disconnect Google Calendar; completion sound on/off (per device).
- **Tasks / lists** — inline add, task detail panel with priority, estimate, due date, steps, notes.
- **Important** — starred tasks. **Planned** — everything with a due date. **Ticked Tasks** — completed tasks, newest first.
- **Routines** — daily / every N days / weekly / monthly, optional weekday picks and from/to dates, steps that reset per day.

Every list has a live search box, drag handles to reorder (order is saved), a star to mark important, and a red dot on overdue tasks.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · PostgreSQL · Drizzle ORM ·
Better Auth

## Setup

```bash
nvm use            # Node 22
npm install
cp .env.example .env   # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm run db:push        # create tables
npm run dev
```

The app runs at http://localhost:3000.

## Google Calendar

Optional. Create an OAuth client (Web application) in Google Cloud, enable the Calendar API, and add
`<BETTER_AUTH_URL>/api/auth/callback/google` as a redirect URI. Set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`, then connect the account from Settings. Simon requests
`calendar.readonly` and reads the primary calendar for the current day only; nothing is cached.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:push` | Push the Drizzle schema to Postgres |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:studio` | Drizzle Studio |

## Layout

```
src/app        routes and API handlers
src/components UI components (shadcn/ui in components/ui)
src/db         Drizzle schema and client
src/lib        auth, session, date and recurrence helpers, server queries
brand/         brand guidelines and logo assets
.agents/skills repository skills for AI agents
```

Brand colors, typography, and UI conventions are documented in `brand/BRAND.md` and
`.agents/skills/`.
