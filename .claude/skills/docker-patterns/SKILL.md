# Docker Patterns - Production-Ready Containerization

## Purpose

This skill provides battle-tested Docker patterns and best practices for building, securing, and deploying containerized applications in 2024-2025. Focus on Bun/TypeScript/MongoDB stack with production-grade configurations.

---

## Core Principles

### 1. Multi-Stage Everything

- Separate build from runtime
- Copy only artifacts, not tools
- 50-80% size reduction

### 2. Security by Default

- Non-root users always
- Secrets via filesystem, never env vars
- Read-only containers where possible

### 3. Cache Optimization

- Dependencies before source code
- Cleanup in same layer
- BuildKit cache mounts

### 4. Observable & Resilient

- Health checks on all services
- Structured JSON logging
- Graceful shutdown handling

---

## Quick Reference

### Multi-Stage Build Template (Bun)

```dockerfile
# Base
FROM oven/bun:1.1.10-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run typecheck && bun run build

# Production
FROM base AS production
RUN apk add --no-cache curl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER bun
EXPOSE 3000
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
CMD ["bun", "run", "dist/index.js"]
```

### Docker Compose with Secrets & Health Checks

```yaml
version: '3.8'

services:
    mongodb:
        image: mongo:7-alpine
        secrets:
            - mongo_root_password
        healthcheck:
            test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
            interval: 10s
            timeout: 5s
            retries: 5
            start_period: 30s

    app:
        build: .
        depends_on:
            mongodb:
                condition: service_healthy
        secrets:
            - mongo_password
            - jwt_secret
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
            interval: 30s
            timeout: 10s
            retries: 3

secrets:
    mongo_root_password:
        file: ./secrets/mongo_root_password.txt
    mongo_password:
        file: ./secrets/mongo_password.txt
    jwt_secret:
        file: ./secrets/jwt_secret.txt
```

### .dockerignore Essentials

```gitignore
node_modules/
.bun/
dist/
*.log
.git/
.env
.env.*
!.env.example
coverage/
*.test.ts
.DS_Store
Dockerfile*
docker-compose*
```

---

## Pattern Catalog

### Pattern 1: Layer Caching Optimization

**Problem:** Rebuilds download all dependencies on code changes.

**Solution:** Separate dependency installation from code copy.

```dockerfile
# WRONG - Invalidates cache on any change
COPY . .
RUN bun install

# RIGHT - Cache dependencies separately
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
```

**Impact:** 10x faster rebuilds during development.

---

### Pattern 2: Non-Root User Security

**Problem:** Container runs as root, enabling privilege escalation.

**Solution:** Switch to non-privileged user.

```dockerfile
# Create user (if not exists in base image)
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodejs

USER nodejs

# Or use existing user (Bun images)
USER bun
```

**Impact:** Prevents container breakout attacks.

---

### Pattern 3: Docker Secrets (Not Env Vars)

**Problem:** Environment variables expose secrets in logs and process lists.

**Solution:** Use Docker Secrets mounted at `/run/secrets/`.

```yaml
# docker-compose.yml
secrets:
    db_password:
        file: ./secrets/db_password.txt

services:
    app:
        secrets:
            - db_password
```

```typescript
// src/config.ts
import { readFileSync } from 'fs';

const dbPassword = readFileSync('/run/secrets/db_password', 'utf8').trim();
```

**Impact:** Secrets encrypted at rest, never in images.

---

### Pattern 4: Service Health Checks

**Problem:** Dependent services start before dependencies are ready.

**Solution:** Implement health checks with `depends_on: service_healthy`.

```yaml
mongodb:
    healthcheck:
        test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
        interval: 10s

app:
    depends_on:
        mongodb:
            condition: service_healthy
    healthcheck:
        test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
```

**Impact:** Zero connection errors on startup.

---

### Pattern 5: Base Image Pinning

**Problem:** `latest` tag changes between builds, causing non-deterministic deployments.

**Solution:** Pin to specific versions or digests.

```dockerfile
# POOR
FROM oven/bun:latest

# BETTER
FROM oven/bun:1.1.10-alpine

# BEST (immutable)
FROM oven/bun:1.1.10-alpine@sha256:a8560b36e8b8210634f77d9f7f9efd7ffa463e380b75e2e74aff4511df3ef88c
```

**Impact:** Reproducible builds, supply chain integrity.

---

### Pattern 6: Same-Layer Cleanup

**Problem:** Cleanup in separate RUN command doesn't reduce image size.

**Solution:** Install and cleanup in single layer.

```dockerfile
# WRONG - Cache persists in layer
RUN bun install
RUN bun cache clean

# RIGHT - Clean in same layer
RUN bun install --frozen-lockfile && bun cache clean
```

**Impact:** 30-50% smaller images.

---

### Pattern 7: BuildKit Cache Mounts

**Problem:** Downloading packages repeatedly slows builds.

**Solution:** Use persistent cache mounts (requires BuildKit).

```dockerfile
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
```

**Impact:** 5x faster dependency installation in CI.

---

### Pattern 8: Read-Only Filesystem

**Problem:** Compromised process can modify filesystem.

**Solution:** Mount container filesystem as read-only.

```yaml
services:
    app:
        read_only: true
        tmpfs:
            - /tmp # Writable temp directory
```

**Impact:** Prevents malware persistence.

---

### Pattern 9: Resource Limits

**Problem:** Container can consume all host resources.

**Solution:** Define CPU and memory limits.

```yaml
services:
    app:
        deploy:
            resources:
                limits:
                    cpus: '2.0'
                    memory: 512M
                reservations:
                    cpus: '0.5'
                    memory: 256M
```

**Impact:** Prevents resource exhaustion attacks.

---

### Pattern 10: Structured Logging

**Problem:** Logs difficult to parse and aggregate.

**Solution:** Output JSON to stdout/stderr.

```typescript
import pino from 'pino';

export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	formatters: {
		level: (label) => ({ level: label }),
	},
});

logger.info({ userId: 123, action: 'login' }, 'User logged in');
// Output: {"level":"info","userId":123,"action":"login","msg":"User logged in"}
```

**Impact:** Easy integration with log aggregators (Loki, Datadog).

---

## Production Readiness Checklist

### Build Time

- [ ] Multi-stage Dockerfile implemented
- [ ] Base image pinned to specific version
- [ ] Non-root USER directive set
- [ ] .dockerignore excludes secrets and build artifacts
- [ ] Vulnerability scan passes (Trivy, Snyk)
- [ ] Health check endpoint implemented
- [ ] Logs output JSON to stdout

### Configuration

- [ ] Secrets use Docker Secrets or external vault
- [ ] Environment variables validated with Zod
- [ ] Resource limits defined (CPU, memory)
- [ ] Restart policy set (`unless-stopped`)
- [ ] Health check configured in Compose

### Security

- [ ] Container runs as non-root
- [ ] Read-only filesystem where possible
- [ ] `no-new-privileges` security option set
- [ ] Unnecessary capabilities dropped
- [ ] Network policies defined

### Deployment

- [ ] Image tagged with Git SHA or semver
- [ ] CI/CD pipeline builds and scans image
- [ ] Zero-downtime deployment strategy defined
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

---

## Common Mistakes

| Mistake                       | Why Bad                    | Fix                          |
| ----------------------------- | -------------------------- | ---------------------------- |
| Using `latest` tag            | Non-deterministic          | Pin to `1.2.3` or digest     |
| Secrets in ENV                | Visible in logs            | Use `/run/secrets/`          |
| Running as root               | Privilege escalation       | Add `USER` directive         |
| No health checks              | Bad dependency management  | Implement `/health` endpoint |
| Large build context           | Slow builds, leaks secrets | Create `.dockerignore`       |
| Separate cleanup RUN          | Layers still contain files | Combine in `&&` chain        |
| Missing `depends_on: healthy` | Race conditions            | Wait for health checks       |
| Hardcoded config              | Can't change environments  | Use env vars + validation    |

---

## Integration with Project Stack

### TypeScript + Bun

```dockerfile
# Build stage
FROM oven/bun:1.1.10-alpine AS build
COPY . .
RUN bun run typecheck  # Validates types
RUN bun run build      # Compiles to dist/

# Production stage
FROM oven/bun:1.1.10-alpine
COPY --from=build /app/dist ./dist
CMD ["bun", "run", "dist/index.js"]
```

### MongoDB

```yaml
mongodb:
    image: mongo:7-alpine
    volumes:
        - mongodb_data:/data/db
    secrets:
        - mongo_root_password
    healthcheck:
        test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
```

### Mongoose + Connection Handling

```typescript
// src/db/connection.ts
import mongoose from 'mongoose';
import { config } from '../config';

export async function connectDB() {
	await mongoose.connect(config.DATABASE_URL, {
		serverSelectionTimeoutMS: 5000,
		socketTimeoutMS: 45000,
	});

	logger.info('MongoDB connected');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
	await mongoose.connection.close();
	process.exit(0);
});
```

---

## Tools & Commands

### Build with BuildKit

```bash
export DOCKER_BUILDKIT=1
docker build --target production -t myapp:latest .
```

### Vulnerability Scanning

```bash
# Install Trivy
brew install aquasecurity/trivy/trivy

# Scan image
trivy image myapp:latest
```

### Image Size Analysis

```bash
# Install Dive
brew install dive

# Explore layers
dive myapp:latest
```

### Health Check Testing

```bash
# Start services
docker compose up -d

# Check health status
docker compose ps
docker inspect myapp | jq '.[0].State.Health'
```

### Secrets Management

```bash
# Create secret file
echo "mysecret123" > ./secrets/db_password.txt
chmod 600 ./secrets/db_password.txt

# Verify secret mount
docker compose exec app cat /run/secrets/db_password
```

---

## Debugging

### Container Won't Start

```bash
# Check logs
docker compose logs app

# Run shell in container
docker compose run app sh

# Inspect health check
docker inspect myapp | jq '.[0].State.Health'
```

### Build Cache Issues

```bash
# Force rebuild without cache
docker compose build --no-cache

# Clear all build cache
docker builder prune -a
```

### Permission Errors

```bash
# Check user in container
docker compose run app whoami

# Fix volume permissions
docker compose run app chown -R bun:bun /app/data
```

---

## References

- [Docker Best Practices (Official)](https://docs.docker.com/build/building/best-practices/)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Bun Docker Guide](https://bun.com/docs/guides/ecosystem/docker)
- [Docker Compose Healthchecks](https://last9.io/blog/docker-compose-health-checks/)
- [Research Cache: docker-patterns-2024.md](.claude/skills/research-cache/cache/docker-patterns-2024.md)

---

## Version

- **v1.0.0** (2026-01-03) - Initial skill based on comprehensive 2024-2025 research
