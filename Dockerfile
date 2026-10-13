# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.21.0-alpine3.24

# ---- build: install all deps, build web + server, then extract prod-only server ----
FROM ${NODE_IMAGE} AS build
RUN npm i -g pnpm@12.11.2 --no-fund --no-audit
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @calendar/shared --filter @calendar/server --filter @calendar/web
COPY shared shared
COPY server server
COPY web web
# Build version (X.Y.Z+<sha>, scripts/version.sh) shared by the web bundle and the server so the app can detect a newer deploy.
ARG APP_VERSION=0.1.0
ENV APP_VERSION=$APP_VERSION
RUN pnpm build
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm deploy --prod --filter @calendar/server /out

# ---- runtime: node only (npm/corepack/yarn removed), server + static web ----
FROM ${NODE_IMAGE}
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn*
ARG APP_VERSION=0.1.0
ENV APP_VERSION=$APP_VERSION NODE_ENV=production PORT=3000 DATA_DIR=/data WEB_DIST=/app/web/dist
WORKDIR /app
COPY --from=build /out server
COPY --from=build /app/web/dist web/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "server/dist/index.js"]
