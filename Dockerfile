FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY . .

# ── Install workspace deps ─────────────────────────────────────────────────────
FROM base AS deps
RUN pnpm install --frozen-lockfile

# ── Build frontend ─────────────────────────────────────────────────────────────
FROM deps AS build-frontend
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/quality-check run build

# ── Build API ──────────────────────────────────────────────────────────────────
FROM deps AS build-api
RUN pnpm --filter @workspace/api-server run build

# ── Final image ────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Minimal package.json so npm install resolves migrate.ts deps locally
RUN echo '{"type":"module"}' > package.json
RUN npm install tsx drizzle-orm pg

# API bundle (esbuild bundles all app deps, only needs node itself)
COPY --from=build-api /app/artifacts/api-server/dist ./dist

# Frontend static files — Express serves these at /*
COPY --from=build-frontend /app/artifacts/quality-check/dist/public ./dist/public

# DB migrations — preserve relative path so migrate.ts resolves ../migrations correctly
COPY lib/db/migrations ./migrations
COPY lib/db/scripts/migrate.ts ./scripts/migrate.ts

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000
CMD ["./start.sh"]
