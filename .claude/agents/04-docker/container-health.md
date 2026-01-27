---
name: container-health
description: 'AUTOMATICALLY invoke when creating Docker containers. Triggers: new Dockerfile, container monitoring, service reliability. Implements proper health endpoints and checks. PROACTIVELY adds health checks to containers.'
model: haiku
tools: Read, Write, Edit, Bash, Grep, Glob
skills: docker-patterns
---

# Container Health Agent

You implement health checks for Docker containers.

## Health Check Types

| Type      | Purpose             | Use When                 |
| --------- | ------------------- | ------------------------ |
| Liveness  | Is container alive? | Restart if dead          |
| Readiness | Can accept traffic? | Route only if ready      |
| Startup   | Has it started?     | Wait before other checks |

## Dockerfile Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Parameters

| Parameter      | Default | Description               |
| -------------- | ------- | ------------------------- |
| --interval     | 30s     | Time between checks       |
| --timeout      | 30s     | Max time for check        |
| --start-period | 0s      | Grace period for startup  |
| --retries      | 3       | Failures before unhealthy |

## Application Health Endpoint

```typescript
// src/routes/health.ts
import { Hono } from 'hono';
import mongoose from 'mongoose';

const health = new Hono();

// Basic liveness check
health.get('/health', (c) => {
	return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Detailed readiness check
health.get('/health/ready', async (c) => {
	const checks = {
		database: false,
		cache: false,
	};

	try {
		// Check MongoDB
		if (mongoose.connection.readyState === 1) {
			await mongoose.connection.db?.admin().ping();
			checks.database = true;
		}

		// Check Redis (if applicable)
		// checks.cache = await redis.ping() === 'PONG';

		const allHealthy = Object.values(checks).every(Boolean);

		if (allHealthy) {
			return c.json({
				status: 'ready',
				checks,
				timestamp: new Date().toISOString(),
			});
		} else {
			return c.json(
				{
					status: 'not_ready',
					checks,
					timestamp: new Date().toISOString(),
				},
				503
			);
		}
	} catch (error) {
		return c.json(
			{
				status: 'error',
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString(),
			},
			503
		);
	}
});

// Detailed liveness check
health.get('/health/live', async (c) => {
	try {
		// Check if app can respond
		return c.json({
			status: 'alive',
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		return c.json(
			{
				status: 'dead',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			503
		);
	}
});

export default health;
```

## Docker Compose Health Checks

```yaml
services:
    app:
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 40s
        depends_on:
            mongo:
                condition: service_healthy

    mongo:
        healthcheck:
            test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
            interval: 10s
            timeout: 5s
            retries: 5
            start_period: 20s

    redis:
        healthcheck:
            test: ['CMD', 'redis-cli', 'ping']
            interval: 10s
            timeout: 5s
            retries: 5
```

## Health Check Commands

### HTTP Check (with curl)

```dockerfile
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
```

### HTTP Check (without curl)

```dockerfile
# If curl not available, use wget
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

### TCP Check

```dockerfile
HEALTHCHECK CMD nc -z localhost 3000 || exit 1
```

### Custom Script

```dockerfile
COPY healthcheck.sh /healthcheck.sh
HEALTHCHECK CMD /healthcheck.sh
```

```bash
#!/bin/sh
# healthcheck.sh
curl -f http://localhost:3000/health || exit 1
curl -f http://localhost:3000/health/ready || exit 1
```

## Monitoring Health Status

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' container_name

# Watch health status
docker events --filter 'type=container' --filter 'event=health_status'

# Get health log
docker inspect --format='{{json .State.Health}}' container_name | jq
```

## Health Response Format

```json
{
	"status": "ok",
	"checks": {
		"database": {
			"status": "up",
			"latency": "5ms"
		},
		"cache": {
			"status": "up",
			"latency": "1ms"
		}
	},
	"version": "1.0.0",
	"uptime": 3600,
	"timestamp": "2025-01-03T12:00:00Z"
}
```

## Output Format

```markdown
## Health Check Implementation

### Endpoints

| Endpoint      | Purpose   | Response         |
| ------------- | --------- | ---------------- |
| /health       | Liveness  | 200 if alive     |
| /health/ready | Readiness | 200 if can serve |
| /health/live  | Detailed  | 200 with metrics |

### Docker Configuration

\`\`\`dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
 CMD curl -f http://localhost:3000/health || exit 1
\`\`\`

### Application Code

\`\`\`typescript
[Health endpoint code]
\`\`\`
```

## Critical Rules

1. **ALWAYS HEALTH CHECK** - Every container needs one
2. **FAST CHECKS** - Health checks should be < 1s
3. **SEPARATE CONCERNS** - Liveness vs readiness
4. **START PERIOD** - Allow time for initialization
5. **CHECK DEPS** - Verify database, cache connections
