# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc for native modules
RUN apk add --no-cache libc6-compat openssl

COPY package.json yarn.lock* ./
COPY apps/api/package.json ./apps/api/

RUN yarn install --frozen-lockfile --prefer-offline

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api

WORKDIR /app/apps/api

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npx nest build

# ─── Stage 3: Runner (Production) ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache openssl curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production artifacts
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

# Create logs directory
RUN mkdir -p logs && chown nestjs:nodejs logs

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4000/health/live || exit 1

CMD ["node", "dist/main"]
