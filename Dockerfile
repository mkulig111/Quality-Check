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
RUN pnpm --filter @workspace/quality-check run build

# ── Build API ──────────────────────────────────────────────────────────────────
FROM deps AS build-api
RUN pnpm --filter @workspace/api-server run build

# ── Final image ────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# API bundle — keep original path so pino worker paths hardcoded at build time still resolve
COPY --from=build-api /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Frontend static files — Express serves these at /*
COPY --from=build-frontend /app/artifacts/quality-check/dist/public ./artifacts/api-server/dist/public

# Migrations alongside the bundle so path.join(__dirname, "migrations") resolves correctly
COPY lib/db/migrations ./artifacts/api-server/dist/migrations

EXPOSE 3000
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
