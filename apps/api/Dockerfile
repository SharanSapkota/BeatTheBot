# Voita Kaleva API. Build from the repo root (the workspace packages are bundled in):
#   docker build -f apps/api/Dockerfile -t voita-kaleva-api .
# Runs as the non-root "node" user and listens on $PORT (Render and Railway set it).

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.15.0

# --- base: Node + pnpm ---
FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION
ENV CI=true
RUN npm install --global pnpm@${PNPM_VERSION} && npm cache clean --force

# --- manifests: workspace files only, so the install layers stay cached until they change ---
FROM base AS manifests
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/fact_checker/package.json packages/fact_checker/
COPY packages/i18n/package.json packages/i18n/
COPY packages/prediction_model/package.json packages/prediction_model/
COPY packages/scoring/package.json packages/scoring/
COPY packages/shared_types/package.json packages/shared_types/
# The runtime user must read them (a checkout may have owner-only file modes).
RUN chmod -R a+rX /repo

# --- build: all dependencies, then tsup bundles src + @voita_kone/* into dist/ ---
FROM manifests AS build
RUN pnpm install --frozen-lockfile --filter "@voita_kone/api..."
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @voita_kone/api build

# --- prod_deps: only the runtime dependencies (express, pg, pino, …) ---
FROM manifests AS prod_deps
RUN pnpm install --frozen-lockfile --prod --filter "@voita_kone/api..."

# --- runtime ---
FROM base AS runtime
# No PORT here: Render / Railway set it, and the API uses it (else API_PORT, default 3000).
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod_deps /repo ./
COPY --from=build /repo/apps/api/dist apps/api/dist
# Mount point for a persistent disk with UPLOAD_DIR=/data/uploads (optional, see docs/deploy.md).
RUN mkdir -p /data/uploads && chown node:node /data/uploads
# pnpm --filter api <script> in a shell here must not try to reinstall (node_modules is read-only).
RUN echo "verifyDepsBeforeRun: false" >> pnpm-workspace.yaml
USER node
WORKDIR /app/apps/api
EXPOSE 3000
# node directly (no npm/pnpm wrapper), so SIGTERM reaches the graceful shutdown.
CMD ["node", "dist/server.js"]
