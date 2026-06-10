---
name: Vite workspace lib resolution
description: How to make non-composite pnpm workspace libs resolve in Vite dev server
---

# Vite workspace lib resolution

When a lib package uses `allowImportingTsExtensions: true` (e.g. `@workspace/replit-auth-web`), it cannot be `composite: true` — TypeScript forbids having both. This means the lib can't be a project reference.

**Why:** `allowImportingTsExtensions` requires `noEmit`, which conflicts with `composite`.

**How to apply:**
1. Add a Vite resolve alias pointing directly to the lib's `src/index.ts`:
   ```ts
   "@workspace/replit-auth-web": path.resolve(import.meta.dirname, "../../lib/replit-auth-web/src/index.ts")
   ```
2. Add `fs.allow` for the lib directory so Vite can serve files outside its root:
   ```ts
   fs: { strict: true, allow: [path.resolve(import.meta.dirname), path.resolve(import.meta.dirname, "../../lib")] }
   ```
3. Remove the reference from the artifact's tsconfig.json (avoids TS6306/TS6310 errors).
4. Do NOT add it to root tsconfig.json references (it's not composite).
