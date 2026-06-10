---
name: AuthUser type location
description: Where AuthUser is defined and why it can't come from codegen
---

# AuthUser type

`AuthUser` is a manually defined interface in `lib/api-zod/src/index.ts`, alongside the codegen exports.

**Why:** The orval codegen from the OpenAPI spec doesn't generate a named `AuthUser` type — it only generates inline Zod schema shapes inside `GetCurrentAuthUserResponse`. Extracting a named type from the inferred Zod shape is verbose; a hand-written interface is cleaner and more stable.

**Fields:** `id: string`, `email?`, `firstName?`, `lastName?`, `profileImageUrl?`, `role?: "manager" | "inspector" | null`

Used in:
- `artifacts/api-server/src/lib/auth.ts` (SessionData.user)
- `artifacts/api-server/src/middlewares/authMiddleware.ts` (Express.User)
- `lib/replit-auth-web/src/use-auth.ts` (imported from `@workspace/api-client-react`)
