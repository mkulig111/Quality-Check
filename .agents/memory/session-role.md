---
name: Session role field
description: Role must be written into the session at login time for req.user.role to work
---

# Session role field

The Express authMiddleware sets `req.user = session.user`. For role-based access control to work in routes (`req.user.role === "manager"`), `role` must be stored in the session's `user` object when the session is created.

**Why:** The session is written once at login (auth callback) and then read on every request. If role is not in the session at creation time, it won't be available on req.user.

**How to apply:** In `artifacts/api-server/src/routes/auth.ts`, after `upsertUser()` returns `dbUser`, include `role: dbUser.role ?? undefined` in the `sessionData.user` object before calling `createSession()`.
