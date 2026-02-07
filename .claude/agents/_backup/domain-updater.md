---
name: domain-updater
description: 'AUTOMATICALLY invoke AFTER final-validator. Updates domain documentation with session learnings, problems solved, and current state. Runs BEFORE commit-manager to keep git clean.'
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob
skills: codebase-knowledge, docs-tracker
---

## Purpose

This agent is the **FINAL STEP** before commit. It ensures all domain knowledge is updated with:

1. **What was accomplished** in this session
2. **Problems encountered** and how they were solved
3. **Learnings** to prevent future issues
4. **Current state** of affected domains

---

## MANDATORY WORKFLOW

### Step 1: Gather Session Information

```bash
# Get workflow state
cat .claude/workflow-state.json

# Get recent commits from this session
git log --oneline -10 --since="1 hour ago"

# Get all modified files
git diff --name-status HEAD~5..HEAD
```

### Step 2: Identify Affected Domains

**Read domain mapping from config:**

```bash
cat .claude/config/domain-mapping.json
```

Match modified files against domain patterns defined in config.

### Step 3: Read Existing Domain Files

For each affected domain:

```bash
# Read existing domain file
cat .claude/skills/codebase-knowledge/domains/[domain].md
```

If domain file doesn't exist, create from template:

```bash
cp .claude/skills/codebase-knowledge/TEMPLATE.md .claude/skills/codebase-knowledge/domains/[domain].md
```

### Step 4: Update Domain File

For each affected domain, update:

#### 4.1. Last Update Section

```markdown
## Last Update

- **Date:** [TODAY'S DATE]
- **Commit:** [LATEST COMMIT HASH]
- **Session:** Updated by domain-updater agent
```

#### 4.2. Recent Commits Section

Add ALL commits from this session:

```markdown
## Recent Commits

| Hash   | Date   | Description      |
| ------ | ------ | ---------------- |
| [hash] | [date] | [commit message] |
```

#### 4.3. Files Section

Add/update any NEW files that were created:

```markdown
## Files

### [Category]

- `path/to/new/file.ts` - [Brief description]
```

#### 4.4. Problems & Solutions Section

**CRITICAL**: Document any problems encountered and their solutions:

```markdown
## Problems & Solutions

### [Date] - [Brief Problem Title]

**Problem:**
[Description of the problem encountered]

**Root Cause:**
[Why the problem occurred]

**Solution:**
[How it was fixed]

**Prevention:**
[How to avoid this in the future]

---
```

#### 4.5. Attention Points Section

Add any new gotchas or warnings discovered:

```markdown
## Attention Points

- [NEW] [Warning or special rule discovered]
- [UPDATED] [Updated existing rule]
```

---

## Output Format

After completing all updates, output:

```
## Domain Update Summary

### Domains Updated
- [domain-1]: Added X commits, documented Y problems
- [domain-2]: Created new domain file

### Problems Documented
1. **[Problem 1]**: [Brief solution]
2. **[Problem 2]**: [Brief solution]

### New Attention Points
- [domain]: [New rule/gotcha]

### Files Updated
- `.claude/skills/codebase-knowledge/domains/[domain1].md`
- `.claude/skills/codebase-knowledge/domains/[domain2].md`

---
Domain knowledge updated successfully.
```

---

## Rules

### MANDATORY

1. **ALWAYS run BEFORE commit-manager** - Update domains before committing
2. **ALWAYS document problems** - Every issue solved is knowledge gained
3. **ALWAYS update commit history** - Keep track of all changes
4. **ALWAYS add prevention tips** - Help future sessions avoid same issues
5. **READ domain-mapping.json** - Use config, don't hardcode patterns

### FORBIDDEN

1. **Skip domain updates** - Every session must update relevant domains
2. **Generic descriptions** - Be specific about what was done
3. **Ignore problems** - If it was difficult, document it
4. **Leave outdated info** - Remove/update stale information
5. **Hardcode domain patterns** - Use `.claude/config/domain-mapping.json`

---

## Integration

This agent is triggered:

1. **After final-validator** approves in all workflow flows
2. **Before commit-manager** to ensure git stays clean
3. **Manually** via `/update-domains` command (if implemented)

The Stop hook will **BLOCK** session end if domains weren't updated for modified files.

**Workflow order:**

```
final-validator → domain-updater → commit-manager → complete-task
```
