# syntax=docker/dockerfile:1
#
# Monorepo-Build pro App via `turbo prune <APP> --docker`. Der Build-Kontext ist
# das erzeugte ./out-Verzeichnis (json/ = Manifeste+Lockfile, full/ = Source).
# Aufruf (siehe scripts/build-and-push.sh):
#   pnpm exec turbo prune <app> --docker
#   docker buildx build -f Dockerfile --build-arg APP=<app> --target runner   out
#   docker buildx build -f Dockerfile --build-arg APP=<app> --target migrator out
#
# Image-Artefakte bleiben funktional identisch zum bisherigen Single-Repo-Build
# (runner = Next standalone + `node server.js`; migrator = prisma CLI + recovery).
ARG APP

# ── Basis: Node 24 + pnpm via corepack ───────────────────────────────────────
FROM node:24-alpine AS base
RUN corepack enable
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ── deps: nur Manifeste + Lockfile → Install (cache-stabiler Layer) ───────────
FROM base AS deps
WORKDIR /app
COPY json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── builder: voller Source → turbo build (prisma generate + next build) ───────
FROM base AS builder
ARG APP
WORKDIR /app
COPY --from=deps /app/ .
COPY full/ .
RUN pnpm exec turbo run build --filter="${APP}"

# ── migrator: One-shot Migrations-Job (prisma migrate deploy + Recovery) ──────
# Das App-Skript run-migrations-with-recovery.sh nutzt absolute /app-Pfade
# (/app/node_modules/prisma, /app/scripts) → der Migrator legt die App-Wurzel
# flach auf /app ab und installiert dort prisma CLI + Recovery-Deps.
# Bewusst via npm (nicht pnpm): flaches node_modules, kein pnpm-10-Build-Gate —
# prisma-Engines werden normal per postinstall geholt (wie früher `npm ci`).
FROM node:24-alpine AS migrator
ARG APP
WORKDIR /app
COPY full/apps/${APP}/prisma ./prisma
COPY full/apps/${APP}/prisma.config.ts ./prisma.config.ts
COPY full/apps/${APP}/scripts ./scripts
# Nur was migrate deploy + Recovery braucht: prisma-CLI (zieht @prisma/engines),
# pg (Recovery-Skript), dotenv (von prisma.config.ts importiert). KEIN
# @prisma/client/adapter (effect/electric-sql) und KEIN tsx (esbuild) → schlank.
RUN npm install --no-package-lock --no-save \
      prisma@^7.4.1 pg@^8.19.0 dotenv@^17.3.1
ENV NODE_ENV=production
RUN chmod +x /app/scripts/run-migrations-with-recovery.sh
CMD ["./scripts/run-migrations-with-recovery.sh"]

# ── runner: schlankes Produktions-Image (Next standalone, ohne prisma CLI) ────
FROM node:24-alpine AS runner
ARG APP
ENV APP=${APP}
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone enthält server.js + getractes node_modules (Tracing-Wurzel = Repo).
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP}/public ./apps/${APP}/public

# Upload-Verzeichnis (Compose mountet hier ein Volume; UPLOAD_DIR=/app/uploads).
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# server.js liegt monorepo-bedingt unter apps/<APP>/ (Shell-Form für $APP).
CMD node apps/$APP/server.js
