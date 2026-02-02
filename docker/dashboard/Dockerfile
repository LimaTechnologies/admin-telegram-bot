# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source code (excluding .env files via .dockerignore)
COPY . .

# Remove any .env files that might have been copied
RUN rm -f .env .env.local .env.development .env.development.local

# Build Next.js with explicit production env
# Dummy env vars for build (actual values provided at runtime)
ENV NODE_ENV=production
ENV MONGODB_URI=mongodb://localhost:27017/dummy
ENV REDIS_HOST=localhost
ENV REDIS_PORT=6379
ENV BOT_TOKEN=dummy
ENV S3_ENDPOINT=http://localhost:9000
ENV S3_ACCESS_KEY=dummy
ENV S3_SECRET_KEY=dummy
ENV S3_BUCKET=dummy
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "server.js"]
