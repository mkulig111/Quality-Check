---
name: drizzle-kit-push-tty
description: drizzle-kit push fails non-interactively; use generate+migrate workflow instead
---

`drizzle-kit push` hangs in non-interactive shells (Replit code_execution, CI) when it detects a new UNIQUE constraint on an already-populated table — it prompts "do you want to truncate?" and requires a TTY. The `--force` flag does not bypass this particular prompt.

**Why:** drizzle-kit 0.31.x uses an interactive CLI prompt for potentially destructive DDL suggestions.

**The solution — generate + migrate workflow:**

1. After any schema change: `pnpm --filter @workspace/db run generate` — creates a SQL migration file in `lib/db/migrations/`
2. To apply: `pnpm --filter @workspace/db run migrate` — uses drizzle-orm's migrator directly (non-interactive, no TTY needed), tracks applied migrations in `drizzle.__drizzle_migrations`

**One-time bootstrap for an existing database** (tables exist from a previous `push` but no tracking records):
```
pnpm --filter @workspace/db run stamp
```
The `stamp` script (`lib/db/scripts/stamp.ts`) creates `drizzle.__drizzle_migrations` and inserts records for all existing migration files without re-running their SQL.

**How to apply:** Always use `generate` + `migrate` for schema changes going forward. The `push` script is kept for reference but should not be used.
