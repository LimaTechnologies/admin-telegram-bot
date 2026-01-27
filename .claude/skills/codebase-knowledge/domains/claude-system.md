# Claude System

## Last Update

- **Date:** 2026-01-06
- **Commit:** 77e2263
- **Session:** Fixed stop hook exit code from 2 to 0 for proper JSON processing

## Files

### Agents (14 total)

- `.claude/agents/analyzer.md` - Analyzes change impact, approves files
- `.claude/agents/code-reviewer.md` - **NEW** Reviews code quality, patterns, best practices
- `.claude/agents/commit-manager.md` - Manages git commits, runs complete-task
- `.claude/agents/debugger.md` - **NEW** Traces bugs to root cause, analyzes errors
- `.claude/agents/documenter.md` - Creates/updates documentation
- `.claude/agents/domain-updater.md` - Updates domain knowledge after sessions
- `.claude/agents/final-validator.md` - Final validation with VETO power
- `.claude/agents/orchestrator.md` - Coordinates entire workflow
- `.claude/agents/performance.md` - **NEW** Profiles code, identifies bottlenecks
- `.claude/agents/quality-checker.md` - Runs quality gates
- `.claude/agents/research.md` - Researches best practices (2024-2025) before implementation
- `.claude/agents/security-auditor.md` - Security audit with VETO power
- `.claude/agents/tester.md` - Creates unit and E2E tests
- `.claude/agents/ui-ux-reviewer.md` - Reviews UI/UX patterns

### Scripts

- `.claude/scripts/validate-claude-md.ts` - CLAUDE.md validation (char limit, sections, git state)

### Hooks

- `.claude/hooks/run-hook.ts` - **NEW** Universal hook runner with multi-runtime fallback (python3 -> python -> bun -> npx tsx)
- `.claude/hooks/run-hook.sh` - **NEW** Shell wrapper for Unix/Linux/Mac
- `.claude/hooks/run-hook.cmd` - **NEW** Batch wrapper for Windows
- `.claude/hooks/stop-validator.py` - Stop hook enforcement: branch protection + documentation check
- `.claude/hooks/stop-validator.ts` - **NEW** TypeScript fallback version of stop-validator
- `.claude/hooks/user-prompt-submit.py` - Agent selection guidance before prompt processing
- `.claude/hooks/user-prompt-submit.ts` - **NEW** TypeScript fallback version of user-prompt-submit
- `.claude/hooks/check-documentation.py` - Documentation verification hook
- `.claude/hooks/SETUP.md` - Hook system documentation

### Skills (with Progressive Disclosure)

- `.claude/skills/codebase-knowledge/` - Domain mapping system
- `.claude/skills/docs-tracker/` - Documentation tracking
- `.claude/skills/final-check/` - Final validation rules
- `.claude/skills/quality-gate/` - Quality gate definitions
    - `scripts/check-all.sh` - **NEW** Runs all quality checks
- `.claude/skills/research-cache/` - Best practices research cache
- `.claude/skills/security-scan/` - Security audit rules
    - `reference/owasp-top-10.md` - **NEW** OWASP Top 10 reference
    - `scripts/scan.py` - **NEW** Automated security scanner
- `.claude/skills/test-coverage/` - Test coverage tracking
    - `reference/playwright-patterns.md` - **NEW** Playwright E2E patterns
    - `scripts/coverage-check.sh` - **NEW** Coverage verification script
- `.claude/skills/ui-ux-audit/` - UI/UX audit rules

### Configuration

- `.claude/settings.json` - Agent registration, flows, rules
- `.claude/workflow-state.json` - Current task state
- `.claude/CLAUDE.md` - System documentation

### Config Files (NEW - 2024-12-19)

- `.claude/config/project-config.json` - Stack, structure, commands
- `.claude/config/domain-mapping.json` - File patterns to domains
- `.claude/config/quality-gates.json` - Quality check commands
- `.claude/config/testing-config.json` - Test framework config
- `.claude/config/security-rules.json` - Security audit rules
- `.claude/config/README.md` - Config documentation

### Root Files

- `CLAUDE.md` - Development rules with fallback instruction for agent files (116 lines, generalist)
- `PROJECT.md` - Project-specific details (Solana Listeners)

## Connections

- **All domains:** domain-updater reads/updates domain files after sessions
- **Infrastructure:** Hooks enforce workflow rules project-wide

## Recent Commits

| Hash    | Date       | Description                                                           |
| ------- | ---------- | --------------------------------------------------------------------- |
| 77e2263 | 2026-01-06 | fix: stop hook exit code from 2 to 0 for JSON processing              |
| d429772 | 2026-01-03 | feat(agents): restructure agent system with 82 specialized sub-agents |
| 70ca50f | 2026-01-02 | feat(start-vibing): auto-install Claude Code and self-update          |
| 5c74c95 | 2026-01-02 | feat: add specialized agents and progressive disclosure to skills     |
| b5c483b | 2026-01-02 | docs: add agents/skills comparison research with industry benchmarks  |

## Problems & Solutions

### 2026-01-06 - Stop Hook Exit Code Fix

**Problem:**
When stop hook blocked task completion, Claude was just stopping instead of continuing to fix the issues. The message "Stop hook prevented continuation" appeared but Claude didn't take action.

**Root Cause:**
Stop hook was using `process.exit(2)` which causes Claude Code to **ignore the JSON output**. The `decision: "block"` with `reason` was being sent correctly, but exit code 2 made Claude ignore it and only show stderr.

**Solution:**
Changed exit code from 2 to 0 in `stop-validator.ts`:

```typescript
// Before: process.exit(2);
process.exit(0); // Must be 0 for JSON to be processed!
```

**Key Insight:**
- Exit code 0: JSON stdout is processed (decision, reason fields work)
- Exit code 2: JSON stdout is IGNORED, only stderr shown

**Files Modified:**
- `.claude/hooks/stop-validator.ts` - Changed exit(2) to exit(0) on line 1228
- `.claude/skills/hook-development/SKILL.md` - Updated documentation with correct exit code guidance

**Prevention:**
- Always use exit(0) for Stop hooks that want Claude to continue
- Use `decision: "block"` in JSON to block, not exit code 2
- Exit code 2 is only for PreToolUse hooks (blocks specific tool call)

---

### 2026-01-03 - Universal Hook Runner with Multi-Runtime Fallback

**Problem:**
Stop hook was failing with `/bin/sh: 1: python: not found` error when Python was not installed on the user's system.

**Root Cause:**
Hooks were hardcoded to use `python .claude/hooks/*.py` which fails if Python is not in PATH.

**Solution:**
Created a universal hook runner (`run-hook.ts`) that:

1. Tries multiple runtimes in priority order: python3 -> python -> bun -> npx tsx
2. Python remains primary (user preference)
3. TypeScript versions of hooks serve as fallback
4. Returns safe default if no runtime available (doesn't block user)

**Files Added:**

- `.claude/hooks/run-hook.ts` - Universal runner with runtime detection
- `.claude/hooks/run-hook.sh` - Shell wrapper for Unix
- `.claude/hooks/run-hook.cmd` - Batch wrapper for Windows
- `.claude/hooks/stop-validator.ts` - TypeScript fallback
- `.claude/hooks/user-prompt-submit.ts` - TypeScript fallback

**Files Modified:**

- `.claude/settings.json` - Updated hook commands to use `bun .claude/hooks/run-hook.ts <hook-name>`
- `.claude/hooks/SETUP.md` - Updated documentation

**Prevention:**

- Always provide TypeScript fallbacks for Python hooks
- Use runtime detection instead of hardcoded interpreter paths
- Return safe defaults instead of failing

---

### 2026-01-02 - start-vibing v2.0.0 with Auto-install and Self-update

**Context:**
User wanted start-vibing to automatically install Claude Code and keep itself updated.

**Solution:**

1. Added 3 new modules to start-vibing:
    - `platform.ts` - OS/shell detection (Windows/macOS/Linux)
    - `update.ts` - Self-update check with 1-hour cache
    - `claude.ts` - Claude Code detection/installation/launch
2. CLI now checks npm registry for updates on every run
3. Detects if Claude Code is installed, auto-installs if missing
4. Launches `claude --dangerously-skip-permissions` after setup
5. New CLI options: `--no-claude`, `--no-update-check`

**Result:**

- Published as start-vibing v2.0.0 on npm
- Zero new runtime dependencies
- Works on Windows (PowerShell, CMD), macOS, and Linux

**Files Added:**

- `packages/start-vibing/src/platform.ts`
- `packages/start-vibing/src/update.ts`
- `packages/start-vibing/src/claude.ts`

---

### 2026-01-02 - Added Specialized Agents and Progressive Disclosure

**Context:**
Research showed system scored 8.55/10, missing specialized agents and progressive disclosure.

**Solution:**

1. Added 3 new agents:
    - `performance.md` - Profiles code, identifies bottlenecks, optimizes
    - `debugger.md` - Traces bugs to root cause, analyzes errors
    - `code-reviewer.md` - Reviews code quality before testing
2. Added progressive disclosure to skills:
    - Reference files with detailed knowledge
    - Executable scripts for automation
3. Updated workflows:
    - code-reviewer in default_flow
    - debugger in bug_fix_flow
    - New performance_flow

**Result:**
Score improved from 8.55 to 9.2/10. System now has 14 agents total.

**Files Added:**

- `.claude/agents/code-reviewer.md`
- `.claude/agents/debugger.md`
- `.claude/agents/performance.md`
- `.claude/skills/quality-gate/scripts/check-all.sh`
- `.claude/skills/security-scan/reference/owasp-top-10.md`
- `.claude/skills/security-scan/scripts/scan.py`
- `.claude/skills/test-coverage/reference/playwright-patterns.md`
- `.claude/skills/test-coverage/scripts/coverage-check.sh`

---

### 2026-01-02 - Stop Hook Enhanced for System Files

**Problem:**
Stop hook was only checking source files for documentation, but allowing changes to system/config files (CLAUDE.md, .claude/, PROJECT.md) directly on main branch without branch protection.

**Root Cause:**
SYSTEM_CONFIG_PATTERNS were only used for documentation checks, not for branch protection enforcement.

**Solution:**
Enhanced stop-validator.py to:

1. Created `is_system_config_file()` function to detect system/config files
2. Added `requires_branch_protection()` that checks BOTH source AND system/config files
3. Updated main() logic to detect and block both types of files on main branch
4. System files require branch protection but NOT documentation (they ARE docs/configs)

**Files Modified:**

- `.claude/hooks/stop-validator.py` - Added system/config file detection functions
- `CLAUDE.md` - Added fallback instruction to read agent files directly if Task tool fails

**Prevention:**

- System/config files now treated as protected alongside source code
- Branch protection enforced for CLAUDE.md, .claude/, PROJECT.md
- Documentation requirement applies only to source files, not system files

---

### 2024-12-19 - Workflow Manager Removed

**Problem:**
The workflow-manager.py script and enforcement hooks (pre-tool-use.py, post-tool-use.py, stop-validation.py) were blocking operations and adding unnecessary complexity.

**Root Cause:**
The system was designed with strict workflow enforcement that prevented Claude from working flexibly.

**Solution:**

- Deleted workflow-manager.py, pre-tool-use.py, post-tool-use.py, stop-validation.py
- Removed references from all documentation
- Simplified settings.local.json to only keep UserPromptSubmit hook
- Agents now work independently without state tracking requirements

**Prevention:**
Trust agents to coordinate naturally through Task tool invocation rather than enforcing artificial state machine.

---

- Git tree is clean after session ends

**Prevention:**

- domain-updater priority: 9 (runs after final-validator)
- commit-manager priority: 10 (FINAL step)
- Stop hook enforces both must run before session ends

---

### 2024-12-18 - domain-updater Not Available as Subagent

**Problem:**
Tried to invoke domain-updater via Task tool but got "Agent type 'domain-updater' not found"

**Root Cause:**
Agents defined in `.claude/agents/*.md` are instructions for Claude to follow, not subagent_types in Claude Code system

**Solution:**
Execute domain-updater logic manually or use documenter agent which has similar capabilities

**Prevention:**
To make an agent invokable via Task tool, it needs to be registered in Claude Code's internal system (separate from .claude/agents/)

## Attention Points

- [2026-01-03] **Hooks use universal runner** - `bun .claude/hooks/run-hook.ts <hook-name>` tries python3 -> python -> bun -> npx tsx
- [2026-01-03] **TypeScript hook fallbacks** - All Python hooks have `.ts` versions for when Python unavailable
- [2026-01-02] **System files protected alongside source** - CLAUDE.md, .claude/, PROJECT.md require branch protection
- [2026-01-02] **CLAUDE.md fallback instruction** - If Task tool fails, read agent files directly from .claude/agents/
- [2024-12-18] **Workflow is enforced by hooks** - Cannot skip steps, hooks will block
- [2024-12-18] **domain-updater is MANDATORY** - Stop hook blocks if not executed
- [2026-01-02] **14 agents total** - Added code-reviewer, debugger, performance agents
- ~~[2024-12-18] **10 agents total**~~ - OUTDATED: Now 14 agents
- [2024-12-18] **Config files (.claude/\*) don't require tests** - Excluded from source file checks
- [2024-12-18] ~~**domain-updater runs complete-task**~~ - OUTDATED: commit-manager now runs complete-task
- [2024-12-18] **.claude/agents/ vs subagent_type** - Agents in .claude/agents/ are instructions, not Claude Code subagents
- [2024-12-18] **Never bypass workflow manually** - Follow the agents properly, don't mark as executed without running
- [2024-12-18] **Use Task tool for agents** - UserPromptSubmit now reminds to use Task(subagent_type="agent-name") instead of manual execution
- [2024-12-18] **Workflow order fixed** - domain-updater runs BEFORE commit-manager (not after) for clean git
- [2024-12-18] **commit-manager is FINAL** - It runs complete-task, not domain-updater
- [2024-12-18] **Stop hook enforces commit** - Blocks if domain-updater ran but commit-manager didn't
- [2024-12-18] **Research agent added** - Mandatory for features/fixes, runs after analyzer
- [2026-01-02] **Progressive disclosure** - Skills have reference/ and scripts/ folders for detailed knowledge
- ~~[2024-12-18] **11 agents total**~~ - OUTDATED: Now 14 agents
- [2024-12-18] **workflow-state.json in .gitignore** - Transient state, not tracked in git
- [2024-12-19] **Config files for project specifics** - Agents read from `.claude/config/*.json` instead of hardcoding
- [2024-12-19] **CLAUDE.md < 300 lines** - Best practice from Anthropic, ideally < 60 lines
- [2024-12-19] **PROJECT.md for project details** - Separate from generic CLAUDE.md
- [2024-12-19] **Pre-tool-use wildcard issue** - Pattern `.claude/config/*` doesn't match absolute paths, use specific files
- [2024-12-19] **Tester agent v3.0** - Complete Playwright E2E architecture with fixture-based cleanup
- [2024-12-19] **E2E cleanup is MANDATORY** - Track all created IDs, delete ONLY tracked data after tests
- [2024-12-19] **Multi-viewport testing** - Desktop (1280x800), Tablet (768x1024), iPhone SE (375x667) required
- [2024-12-19] **DB validation in E2E** - Always verify database state after UI actions
- [2024-12-19] **Real auth only** - Never mock authentication in E2E tests
- [2024-12-19] **data-testid required** - All interactive elements must have data-testid attributes
- [2024-12-19] **SKILL.md YAML frontmatter** - ALL skills MUST have `---` frontmatter with name, description
- [2024-12-19] **Skill name format** - max 64 chars, lowercase, letters/numbers/hyphens only
- [2024-12-19] **Skill description** - max 1024 chars, describes WHAT skill does and WHEN to use it
- [2024-12-19] **allowed-tools optional** - Comma-separated tool names to restrict skill capabilities
- [2024-12-19] **Hooks config correct** - settings.json hooks format is valid, uses command type with python scripts

## Problems & Solutions (2024-12-19)

### 2024-12-19 - CLAUDE.md Too Long and Specific

**Problem:**
CLAUDE.md had 594 lines, 95% specific to Solana Listeners project. Too long for Claude to follow consistently.

**Root Cause:**
Project-specific details (workers, docker config, path aliases examples) mixed with universal rules.

**Solution:**

1. Reduced CLAUDE.md to 115 lines (universal rules only)
2. Created `PROJECT.md` with project-specific details
3. Created `.claude/config/` with JSON configs for project specifics
4. Updated agents to read from config files

**Prevention:**

- Keep CLAUDE.md under 300 lines (ideally < 60)
- Put project specifics in PROJECT.md
- Use `.claude/config/` for things agents need to adapt to

---

### 2024-12-19 - Pre-Tool-Use Wildcard Pattern Not Working

**Problem:**
Approved files with pattern `.claude/config/*` but hook still blocked edits to `.claude/config/project-config.json`

**Root Cause:**
Hook checks `file_path.startswith(approved[:-1])` but file_path is absolute path `C:/Users/.../` while approved is relative `.claude/config/*`

**Solution:**
Approve each file individually instead of using wildcard patterns

**Prevention:**
When using approve-files, list specific files rather than wildcards if path matching issues occur

---

### 2024-12-19 - E2E Test Data Pollution

**Problem:**
E2E tests created data in the database but didn't clean up, causing test pollution and confusion with real data.

**Root Cause:**
Tests were creating users, items, etc. but not tracking or deleting them after completion.

**Solution:**
Implemented fixture-based cleanup pattern:

1. `createdIds` fixture tracks all created document IDs by collection
2. `trackCreated(collection, id)` function to register created data
3. Auto-cleanup runs after each test, even on failure
4. Only deletes tracked IDs, never affects real data

**Prevention:**

- Always use `trackCreated()` immediately after creating data
- Use the custom `test` from fixtures, not base Playwright `test`
- Verify cleanup is working with DB inspection

---

### 2024-12-19 - Tester Agent Missing E2E Architecture

**Problem:**
Tester agent didn't have comprehensive E2E testing patterns for Playwright.

**Root Cause:**
Previous version focused on unit tests, lacked E2E architecture.

**Solution:**
Rewrote tester.md with complete Playwright architecture:

- Fixture-based cleanup pattern
- Multi-viewport testing (desktop, tablet, mobile)
- Database validation after UI actions
- API testing (REST and tRPC)
- Real authentication flows
- Storage state for session reuse
- Security testing (forbidden requests, rate limiting)

**Prevention:**

- Always test all viewports
- Always verify DB state, don't trust UI alone
- Use real auth, never mock it

---

### 2024-12-19 - Skills Missing YAML Frontmatter

**Problem:**
All SKILL.md files started with `# Title` instead of YAML frontmatter, making them undiscoverable by Claude Code.

**Root Cause:**
Skills were created as plain markdown without the required YAML frontmatter that Claude Code uses to discover and load skills.

**Solution:**
Added YAML frontmatter to all 8 SKILL.md files:

```yaml
---
name: skill-name-lowercase
description: What skill does and when to use it
allowed-tools: Tool1, Tool2 # optional
---
```

**Fixed Files:**

- quality-gate, security-scan, codebase-knowledge, docs-tracker
- final-check, ui-ux-audit, research-cache, test-coverage

**Prevention:**

- Quality-checker now validates SKILL.md format
- All new skills MUST start with YAML frontmatter
- name: lowercase-with-hyphens, max 64 chars
- description: non-empty, max 1024 chars
