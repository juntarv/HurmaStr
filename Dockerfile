# syntax=docker/dockerfile:1

# ============================================================================
#  HurmaStr — Docker образ (Next.js 16 + Prisma 7 + SQLite/better-sqlite3)
#
#  Важливо:
#   • better-sqlite3 — нативний модуль; збираємо і виконуємо на ОДНІЙ базі
#     (node:22-bookworm-slim), тож бінарник сумісний.
#   • SQLite-файл і вкладення довідок ЖИВУТЬ НА ТОМАХ (/data, /app/storage),
#     інакше дані зникнуть при передеплої.
#   • Схема застосовується при старті (prisma db push) — див. entrypoint.
# ============================================================================

# ------------------------------- builder ------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Інструменти для можливої компіляції нативних модулів + openssl для Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Плейсхолдери, щоб `next build` не падав на відсутніх env (реальні — у рантаймі)
ENV DATABASE_URL="file:/tmp/build.db"
ENV AUTH_SECRET="build-time-placeholder"
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ------------------------------- runner -------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# node_modules несе скомпільований better-sqlite3, Prisma CLI/движки, tsx, next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Каталоги під томи (БД і вкладення)
RUN chmod +x docker-entrypoint.sh \
    && mkdir -p /data /app/storage/leave-attachments \
    && chown -R node:node /data /app/storage
USER node

EXPOSE 3000

# Проста перевірка живучості через вбудований fetch Node 22
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
