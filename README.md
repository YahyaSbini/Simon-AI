# Simon

A personal AI assistant for tasks and email. This stage covers auth, lists and tasks, routines,
and a My Day view. Google Calendar comes next.

## Views

- **My Day** — today's routine occurrences and tasks (flagged for today or due), with remaining time.
- **Tasks / lists** — inline add, task detail panel with priority, estimate, due date, steps, notes.
- **Important** — medium and high priority tasks. **Planned** — everything with a due date.
- **Routines** — daily / every N days / weekly by weekday / monthly by date, completed per date.

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
