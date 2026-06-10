---
name: Username/password auth migration
description: Replaced Replit OIDC with bcrypt username/password auth; covers breaking changes and initial credentials
---

## What changed
- Removed openid-client from api-server (was breaking build after migration)
- `lib/auth.ts` and `authMiddleware.ts` no longer import openid-client — refresh token logic removed
- `POST /api/auth/login` now validates username+bcrypt — returns both cookie (web) and token in body (mobile)
- `POST /api/auth/logout` replaces GET /logout redirect
- `lib/db/schema/auth.ts` — added `username` (unique) and `passwordHash` columns to usersTable

## Web app
- New `artifacts/quality-check/src/lib/auth-context.tsx` — AuthProvider + useAuth() (replaces @workspace/replit-auth-web)
- All three consumers updated: login.tsx, header.tsx, dashboard.tsx

## Mobile app
- `lib/auth.tsx` — expo-auth-session removed, simple fetch to /api/auth/login, Bearer token in SecureStore

## Initial credentials
- Default admin: username=admin, password=Admin1234! (seeded via SQL)

**Why:** User requested no external OAuth dependency; factory workers need username/password credentials set by manager.

**How to apply:** When creating new users, POST /api/users with username+password+role (manager-only). bcryptjs is the hashing library.
