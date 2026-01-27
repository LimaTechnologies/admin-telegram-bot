# Claude Development System - Agent Context

This file provides context for all agents. For user-facing rules, see `/CLAUDE.md`.

---

## CLAUDE.md Validation (STOP HOOK ENFORCED)

The stop hook validates `/CLAUDE.md` before allowing task completion:

| Check             | Requirement                                               |
| ----------------- | --------------------------------------------------------- |
| Character limit   | Max 40,000 chars                                          |
| Required sections | Last Change, 30s Overview, Stack, Architecture            |
| Last Change       | Must be updated with session info (branch, date, summary) |
| No stacking       | Only ONE Last Change section (latest only)                |
| Branch            | Must be on main (PR merged)                               |
| Git tree          | Must be clean (no uncommitted changes)                    |

**If CLAUDE.md exceeds 40k chars:** Compact it by removing verbose explanations, keeping critical sections.

**If not on main:** Complete PR workflow (commit, push, PR, merge, checkout main).

---

## System Architecture

```
.claude/
├── agents/          # 82 specialized agents in 14 categories
├── skills/          # 22 skill systems with cache
├── scripts/         # Validation scripts (validate-claude-md.ts)
├── config/          # Project-specific configuration
├── commands/        # Slash commands
└── hooks/           # stop-validator.ts, user-prompt-submit.ts
```

---

## MCP Servers (MANDATORY FOR AGENTS)

All agents MUST use these MCP servers when applicable:

| Server                | Purpose                            | Use In Agents                           |
| --------------------- | ---------------------------------- | --------------------------------------- |
| `context7`            | Up-to-date library documentation   | research, analyzer, tester              |
| `sequential-thinking` | Complex problem-solving            | orchestrator, analyzer, final-validator |
| `memory`              | Persistent knowledge graph         | domain-updater, commit-manager          |
| `playwright`          | Browser automation and E2E testing | tester, ui-ux-reviewer                  |
| `nextjs-devtools`     | Next.js specific development tools | analyzer (Next.js projects)             |
| `mongodb`             | MongoDB database operations        | tester, security-auditor                |

### Agent MCP Usage Rules

- **research agent**: MUST use `context7` for library docs before recommending patterns
- **tester agent**: MUST use `playwright` for E2E tests
- **analyzer agent**: SHOULD use `context7` to verify current API patterns
- **domain-updater**: SHOULD use `memory` to persist patterns across sessions
- **ui-ux-reviewer**: MUST use `playwright` to verify UI implementations

---

## Configuration Files

Project-specific settings are in `.claude/config/`:

| File                  | Purpose                        |
| --------------------- | ------------------------------ |
| `project-config.json` | Stack, structure, commands     |
| `domain-mapping.json` | File patterns to domains       |
| `quality-gates.json`  | Quality check commands         |
| `testing-config.json` | Test framework and conventions |
| `security-rules.json` | Security audit rules           |

**RULE:** Agents MUST read config files before acting. Do NOT hardcode project specifics.

---

## Agent → Skill Mapping

| Agent            | Primary Skill      | Secondary                        |
| ---------------- | ------------------ | -------------------------------- |
| analyzer         | codebase-knowledge | -                                |
| research         | research-cache     | codebase-knowledge               |
| documenter       | docs-tracker       | codebase-knowledge               |
| tester           | test-coverage      | -                                |
| ui-ux-reviewer   | ui-ux-audit        | -                                |
| security-auditor | security-scan      | -                                |
| quality-checker  | quality-gate       | -                                |
| final-validator  | final-check        | ALL                              |
| commit-manager   | workflow-state     | docs-tracker, codebase-knowledge |
| domain-updater   | codebase-knowledge | docs-tracker                     |

---

## Execution Protocol

### Before ANY implementation:

1. **Read config** from `.claude/config/` for project specifics
2. Read relevant skill SKILL.md file
3. Check skill cache for existing data
4. Research if needed (web search)

### After implementation:

1. Update skill cache with changes
2. Run quality gates + record results
3. Security audit (if auth/data involved)
4. Final validation
5. **Update domains** via domain-updater agent (BEFORE commit, keeps git clean)
6. **Commit** via commit-manager agent (FINAL step)

---

## HTTP Requests (MANDATORY)

All HTTP requests MUST use **axios** with proper configuration.

### Base Setup

```typescript
// lib/api/axios.ts - Create a configured axios instance
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  withCredentials: true, // ALWAYS for auth cookies/sessions
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
    }
    return Promise.reject(error);
  }
);
```

### Usage Rules

| Rule | Description |
|------|-------------|
| ALWAYS use `api` instance | Never raw `axios.get()` or `fetch()` |
| ALWAYS `withCredentials: true` | Required for cookies/sessions |
| Extend for specific APIs | Create `api.auth`, `api.payments`, etc. |
| Type responses | `api.get<UserResponse>('/users')` |
| Handle errors centrally | Use interceptors, not try/catch everywhere |

### When to Create API Wrapper

```typescript
// If you call the same endpoint multiple times, create a wrapper:
// lib/api/users.ts
export const usersApi = {
  getAll: () => api.get<User[]>('/users'),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: CreateUser) => api.post<User>('/users', data),
  update: (id: string, data: UpdateUser) => api.patch<User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};
```

### FORBIDDEN

| Don't | Do Instead |
|-------|------------|
| `fetch('/api/...')` | `api.get('/...')` |
| `axios.get(...)` | `api.get(...)` |
| `withCredentials: false` | Always `true` |
| Inline error handling | Use interceptors |

---

## VETO Power Agents

These agents CAN and MUST stop the flow if rules are violated:

| Agent                | Blocks When                                         |
| -------------------- | --------------------------------------------------- |
| **security-auditor** | User ID from request, sensitive data, no validation |
| **final-validator**  | Any rule violated, tests failing, docs missing      |

---

## Quality Requirements

All implementations MUST:

- [ ] Pass typecheck (command from config)
- [ ] Pass lint (command from config)
- [ ] Pass unit tests (command from config)
- [ ] Pass E2E tests (command from config)
- [ ] Pass build (command from config)
- [ ] Have E2E tests with real auth
- [ ] Have documentation in `docs/`
- [ ] Be security audited
- [ ] Be committed with conventional commits
- [ ] Have domains updated with session learnings

---

## Domain Updater Agent

The **domain-updater** runs BEFORE commit-manager to ensure git stays clean.

### Purpose

- Document **problems encountered** during the session
- Record **solutions** applied to fix issues
- Add **prevention tips** for future sessions
- Update **attention points** with new learnings
- Keep domain knowledge **current and accurate**

### Trigger

Runs automatically:

1. After final-validator approves in any workflow
2. BEFORE commit-manager (so changes are included in commit)
3. Stop hook blocks session end until domain-updater executes (if files were modified)

### Workflow Order

```
final-validator → domain-updater → commit-manager → complete-task
                       ↑                    ↑
              (updates domains)    (commits all + archives)
```

### Configuration

Reads domain patterns from `.claude/config/domain-mapping.json`
