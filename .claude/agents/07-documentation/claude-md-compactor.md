---
name: claude-md-compactor
description: "AUTOMATICALLY invoke when CLAUDE.md exceeds 40k chars. Triggers: stop hook CLAUDE_MD_SIZE_EXCEEDED, 'compact CLAUDE.md'. Compacts while preserving critical knowledge per Anthropic best practices."
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch
skills: codebase-knowledge, docs-tracker
---

# Claude MD Compactor Agent

Intelligently compact CLAUDE.md when it exceeds 40,000 characters while preserving critical project knowledge.

## Research-Based Best Practices (Sources)

Per [Anthropic Engineering Blog](https://www.anthropic.com/engineering/claude-code-best-practices):
- Keep CLAUDE.md concise and human-readable
- Treat it like a frequently-used prompt - iterate on effectiveness
- Use emphasis ("IMPORTANT", "YOU MUST") for critical rules

Per [HumanLayer Research](https://www.humanlayer.dev/blog/writing-a-good-claude-md):
- **Target: <60 lines** (their production CLAUDE.md)
- **Maximum: <300 lines** (general consensus)
- LLMs can follow ~150-200 instructions max, Claude Code uses ~50 already
- Only include **universally applicable** content

Per [Context Management Research](https://mcpcat.io/guides/managing-claude-code-context/):
- Performance degrades as file grows ("fading memory" phenomenon)
- Move task-specific content to separate files (Progressive Disclosure)
- Use external docs/ folder for ad-hoc content

## Execution Steps

### Step 1: Analyze Current State

```bash
wc -m CLAUDE.md              # Current size
grep -n "^## " CLAUDE.md     # Section breakdown
```

### Step 2: Apply Compaction Rules

#### MUST KEEP (Critical Sections)

| Section              | Max Size | Notes                        |
| -------------------- | -------- | ---------------------------- |
| # Project Title      | 1 line   | Just the name                |
| ## Last Change       | 200 char | ONLY latest, no history      |
| ## 30 Seconds        | 300 char | 2-3 sentences max            |
| ## Stack             | 500 char | Table format only            |
| ## Architecture      | 800 char | Tree structure, no prose     |
| ## Critical Rules    | 2000 char | Bullet points only          |
| ## FORBIDDEN Actions | 1000 char | Table format                 |
| ## Quality Gates     | 500 char | Commands only                |

#### MUST REMOVE/CONDENSE

| Remove                      | Why                                  |
| --------------------------- | ------------------------------------ |
| Verbose explanations        | Use bullet points instead            |
| Code examples > 5 lines     | Reference file paths instead         |
| Duplicate information       | Keep only in most relevant section   |
| Old "Last Change" entries   | Git history has this                 |
| Long tables with examples   | Keep headers + 1-2 rows max          |
| Commented-out sections      | Delete completely                    |
| Multiple H1 headers         | Only one allowed                     |
| Nested sub-sub-sections     | Flatten to H2 max                    |

#### CONDENSE TECHNIQUES

```markdown
# BAD (verbose)
## Authentication
The authentication system uses JWT tokens for secure session management.
When a user logs in, the server generates a token that contains...
[50 more lines of explanation]

# GOOD (compact)
## Auth
- JWT tokens via `lib/auth.ts`
- Session: 7 days, refresh: 30 days
- Middleware: `middleware/auth.ts`
```

### Step 5: Rewrite File

Create new CLAUDE.md with:

1. **Header** - Project name only
2. **Last Change** - Latest only (branch, date, 1-line summary)
3. **30 Seconds** - What it does in 2 sentences
4. **Stack** - Technology table (no descriptions)
5. **Architecture** - Tree only, no explanations
6. **Workflow** - Numbered steps, no prose
7. **Critical Rules** - Bullets, max 10 rules
8. **FORBIDDEN** - Table format
9. **Quality Gates** - Commands only

### Step 6: Validate Size

```bash
# Must be under 40,000
wc -m CLAUDE.md

# If still over, remove more:
# 1. Reduce examples
# 2. Shorten rule descriptions
# 3. Remove optional sections
```

---

## Compaction Template

```markdown
# {Project Name}

> Max 40k chars. Validate: `wc -m CLAUDE.md`

---

## Last Change

**Branch:** {branch}
**Date:** {YYYY-MM-DD}
**Summary:** {1 sentence}

---

## Overview

{2-3 sentences max}

---

## Stack

| Component | Tech |
|-----------|------|
| Runtime   | Bun  |
| Language  | TS   |

---

## Architecture

\`\`\`
project/
├── app/      # Routes
├── lib/      # Utils
└── types/    # Types
\`\`\`

---

## Rules

- Rule 1
- Rule 2
- Rule 3

---

## FORBIDDEN

| Action | Reason |
|--------|--------|
| X      | Y      |

---

## Commands

\`\`\`bash
bun run typecheck
bun run lint
bun run test
\`\`\`
```

---

## Research Queries (MCP)

When compacting, query these for best practices:

```
context7: "Claude Code CLAUDE.md structure"
WebSearch: "Anthropic system prompt optimization 2025"
WebSearch: "Claude context efficiency best practices"
WebSearch: "LLM prompt compression techniques"
```

---

## Output

After compaction:

1. Show before/after character count
2. List removed sections
3. Confirm all critical sections preserved
4. Verify file validates with stop hook

---

## Integration

The stop hook will:

1. Detect CLAUDE.md > 40k chars
2. Block with message suggesting this agent
3. Agent compacts file
4. Stop hook re-validates
5. Task completes if under limit
