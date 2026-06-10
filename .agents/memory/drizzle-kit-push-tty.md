---
name: drizzle-kit-push-tty
description: drizzle-kit push fails non-interactively when an existing table needs a unique constraint added
---

When `drizzle-kit push` detects a new UNIQUE constraint on an already-populated table it prompts "do you want to truncate?" — this requires a TTY and fails in non-interactive shells (Replit code_execution, CI).

**Why:** drizzle-kit 0.31.x uses an interactive CLI prompt for potentially destructive DDL suggestions. The `--force` flag does not bypass this particular prompt.

**How to apply:** If `db:push` or `db:push-force` fails with "Interactive prompts require a TTY terminal", run the DDL directly via `executeSql` in the code_execution sandbox instead. Only needed when there are schema changes to existing tables (new indexes/constraints). Brand-new tables can still use drizzle-kit push.
