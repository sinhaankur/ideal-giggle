FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

USER nextjs
EXPOSE 3000

CMD ["pnpm", "start"]

FROM node:22-bookworm-slim AS deps-ollama
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder-ollama
WORKDIR /app

RUN corepack enable

COPY --from=deps-ollama /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-bookworm-slim AS runner-ollama
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_BASE_URL=http://127.0.0.1:11434
ENV OLLAMA_MODEL=llama3.2
ENV OLLAMA_AUTO_PULL=true

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://ollama.com/install.sh | sh

COPY --from=builder-ollama /app/package.json ./package.json
COPY --from=builder-ollama /app/node_modules ./node_modules
COPY --from=builder-ollama /app/.next ./.next
COPY --from=builder-ollama /app/public ./public
COPY --from=builder-ollama /app/next.config.mjs ./next.config.mjs
COPY --from=builder-ollama /app/scripts/start-with-ollama.sh /usr/local/bin/start-with-ollama.sh

RUN chmod +x /usr/local/bin/start-with-ollama.sh && mkdir -p /root/.ollama

EXPOSE 3000
EXPOSE 11434

CMD ["/usr/local/bin/start-with-ollama.sh"]