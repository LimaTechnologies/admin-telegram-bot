# MCP Integration Domain

> **Last Updated:** 2025-01-04
> **Research Date:** 2025-01-04
> **Commit:** (pending)

---

## Overview

Model Context Protocol (MCP) is an open standard created by Anthropic in November 2024 that enables AI models to securely interact with external tools, data sources, and systems through standardized server implementations.

As of November 2025, MCP has been donated to the **Agentic AI Foundation (AAIF)** under the Linux Foundation, co-founded by Anthropic, Block, and OpenAI, with support from Google, Microsoft, AWS, Cloudflare, and Bloomberg.

---

## File Mappings

| File                                   | Purpose                                        |
| -------------------------------------- | ---------------------------------------------- |
| `.claude/config/mcp-config.json`       | MCP server configurations and security rules   |
| `.claude/scripts/setup-mcps.ts`        | Full auto-installer with parallel installation |
| `.claude/scripts/mcp-quick-install.ts` | Quick installer for core MCPs                  |
| `.mcp.json`                            | Project-scoped MCP config (team shared)        |

---

## Recommended MCP Servers

### Tier 1: Core Development (Must Have)

| MCP                     | Publisher | Purpose                         | Agent Mapping                  |
| ----------------------- | --------- | ------------------------------- | ------------------------------ |
| **Context7**            | Upstash   | Real-time library documentation | research, analyzer             |
| **Sequential Thinking** | Anthropic | Structured reasoning            | orchestrator, analyzer         |
| **Playwright**          | Microsoft | Browser automation, E2E testing | tester, ui-ux-reviewer         |
| **Memory**              | Anthropic | Persistent context              | domain-updater, commit-manager |
| **Next.js DevTools**    | Vercel    | Next.js 16+ development         | debugger, performance          |
| **MongoDB**             | MongoDB   | Database operations             | analyzer, debugger             |
| **GitHub**              | GitHub    | Repository management           | commit-manager, code-reviewer  |

### Tier 2: Enhanced Productivity

| MCP              | Publisher | Purpose           | Agent Mapping             |
| ---------------- | --------- | ----------------- | ------------------------- |
| **Sentry**       | Sentry    | Error tracking    | debugger, quality-checker |
| **Figma**        | Figma     | Design to code    | ui-ux-reviewer            |
| **Brave Search** | Brave     | Web research      | research                  |
| **Time**         | Anthropic | Timezone handling | commit-manager            |

### Tier 3: Infrastructure

| MCP            | Publisher | Purpose              | Agent Mapping   |
| -------------- | --------- | -------------------- | --------------- |
| **Docker Hub** | Docker    | Container management | quality-checker |
| **Upstash**    | Upstash   | Redis/rate limiting  | performance     |
| **Fetch**      | Anthropic | HTTP API requests    | research        |

---

## Security Guidelines

### Trusted Publishers

Only install MCPs from verified publishers:

- `modelcontextprotocol` (Anthropic)
- `github`
- `microsoft`
- `vercel`
- `mongodb-js`
- `upstash`
- `docker`
- `figma`
- `getsentry`

### Red Flags (DO NOT Install)

- Publishers not in trusted list
- Missing repository URL
- MCPs requesting excessive permissions
- MCPs with `eval()` or `exec()` in source
- MCPs with recent CVEs

### Critical Vulnerabilities Found (2025)

| CVE           | Package    | Severity       | Issue                   |
| ------------- | ---------- | -------------- | ----------------------- |
| CVE-2025-6514 | mcp-remote | Critical (9.6) | RCE via OAuth discovery |

**43% of public MCP servers have command injection flaws** according to Backslash Security analysis.

### Security Best Practices

1. Use fine-grained tokens with minimal permissions
2. Enable `readOnly` mode for production databases
3. Never commit API keys to version control
4. Use containerized MCPs when available
5. Review MCP source code before installation
6. Monitor MCP activity logs

---

## Installation

### Quick Install (Core MCPs)

```bash
bun .claude/scripts/mcp-quick-install.ts
```

### Full Install with Options

```bash
# Install core tier only (default)
bun .claude/scripts/setup-mcps.ts

# Install all tiers
bun .claude/scripts/setup-mcps.ts --tier=all

# Preview installation
bun .claude/scripts/setup-mcps.ts --dry-run

# Force reinstall
bun .claude/scripts/setup-mcps.ts --force
```

### Manual Installation

```bash
# Add local stdio server
claude mcp add -s user <name> -- npx -y <package>

# Add remote HTTP server
claude mcp add --transport http -s user <name> <url>

# List installed servers
claude mcp list

# Remove server
claude mcp remove <name>

# Debug server issues
claude --mcp-debug
```

---

## Configuration

### Scopes

| Scope     | Location                      | Shared |
| --------- | ----------------------------- | ------ |
| `user`    | `~/.claude/settings.json`     | No     |
| `project` | `.mcp.json`                   | Yes    |
| `local`   | `.claude/settings.local.json` | No     |

### Example .mcp.json

```json
{
	"context7": {
		"command": "npx",
		"args": ["-y", "@upstash/context7-mcp@latest"]
	},
	"playwright": {
		"command": "npx",
		"args": ["-y", "@playwright/mcp@latest"]
	},
	"mongodb": {
		"command": "npx",
		"args": ["-y", "@mongodb-js/mongodb-mcp-server"],
		"env": {
			"MONGODB_URI": "${MONGODB_URI}"
		}
	}
}
```

---

## Environment Variables

| Variable                       | MCP          | Required For        |
| ------------------------------ | ------------ | ------------------- |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub       | Repo access         |
| `MONGODB_URI`                  | MongoDB      | Database connection |
| `BRAVE_API_KEY`                | Brave Search | Search API          |
| `UPSTASH_EMAIL`                | Upstash      | Redis access        |
| `UPSTASH_API_KEY`              | Upstash      | Redis access        |
| `DOCKER_HUB_PAT`               | Docker Hub   | Container registry  |

---

## Troubleshooting

### Common Issues

| Problem               | Solution                          |
| --------------------- | --------------------------------- |
| Server shows "failed" | Check `claude --mcp-debug` output |
| Timeout on startup    | Increase `MCP_TIMEOUT` env var    |
| Tool not available    | Restart Claude Code after adding  |
| Auth errors           | Verify tokens/credentials are set |

### Debug Commands

```bash
# Show MCP status
/mcp

# Launch with debug mode
claude --mcp-debug

# Check specific server
claude mcp get <name>

# View logs (Windows)
type %APPDATA%\Claude\logs\*.log
```

---

## Agent Integration

### How MCPs Map to Agents

| Agent           | Primary MCP              | How It Helps               |
| --------------- | ------------------------ | -------------------------- |
| research        | Context7, Brave Search   | Gets current documentation |
| analyzer        | Context7, MongoDB        | Analyzes code patterns     |
| debugger        | Sentry, Next.js DevTools | Tracks errors              |
| tester          | Playwright               | Runs E2E tests             |
| ui-ux-reviewer  | Figma, Playwright        | Design validation          |
| performance     | Next.js DevTools         | Performance profiling      |
| commit-manager  | GitHub, Memory           | Manages workflow           |
| quality-checker | Playwright, Docker Hub   | Quality gates              |

---

## Research Sources

1. [MCP Official Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
2. [MCP Official Registry](https://registry.modelcontextprotocol.io)
3. [Anthropic MCP Announcement](https://www.anthropic.com/news/model-context-protocol)
4. [GitHub MCP Server](https://github.com/github/github-mcp-server)
5. [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
6. [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server)
7. [Docker MCP Catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/)
8. [MCP Security Analysis - Datadog](https://www.datadoghq.com/blog/monitor-mcp-servers/)
9. [MCP Vulnerabilities - Composio](https://composio.dev/blog/mcp-vulnerabilities-every-developer-should-know)
10. [OWASP MCP Security](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)

---

## Problems & Solutions

### Problem: MCP server times out during installation

**Solution:** Set longer timeout with `MCP_TIMEOUT=120000` environment variable.

### Problem: npx command not found

**Solution:** Install Node.js LTS (v20.19+ or v22.12+).

### Problem: GitHub MCP authentication fails

**Solution:** Create fine-grained PAT with `repo`, `read:org`, `read:user` scopes.

### Problem: MongoDB MCP can't connect

**Solution:** Ensure `MONGODB_URI` is set and accessible from local machine.

---

## Prevention Tips

1. **Always verify publisher** before installing any MCP
2. **Use project scope** for team-shared MCPs (`.mcp.json`)
3. **Use user scope** for personal preferences
4. **Review source code** of MCPs before installation
5. **Set up .env files** for API keys (never commit)
6. **Run security audit** after adding new MCPs
7. **Keep MCPs updated** for security patches

---

## Attention Points

- MCP ecosystem is rapidly evolving (7260+ servers as of May 2025)
- Always check for CVEs before installing new MCPs
- Some MCPs require paid accounts (Figma, Sentry)
- Rate limits apply to many remote MCPs
- Windows users: use `npx tsx` instead of `bun` for hook scripts
