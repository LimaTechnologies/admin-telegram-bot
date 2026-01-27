# Hook Development for Claude Code

> Event-driven automation scripts for Claude Code. Hooks execute in response to system events, enabling validation, policy enforcement, context loading, and workflow integration.

---

## Hook Types

### Prompt-Based Hooks (Recommended)

Use LLM-driven decision making for context-aware validation. Natural language reasoning for complex decisions.

**Supported Events:** Stop, SubagentStop, UserPromptSubmit, PreToolUse

### Command Hooks

Execute bash/shell scripts for deterministic operations. Fast, predictable, no LLM calls.

**Best For:** File system operations, external tool integration, quick validations

---

## Hook Events

| Event | Purpose | Use Case |
|-------|---------|----------|
| **PreToolUse** | Validate/modify tool calls before execution | Block dangerous operations, inject context |
| **PostToolUse** | React to tool completion | Log results, trigger follow-up actions |
| **Stop** | Validate task completeness before agent halts | Enforce branch rules, documentation checks |
| **SubagentStop** | Validate subagent completion | Quality gates for agent outputs |
| **UserPromptSubmit** | Process incoming prompts | Add context, block invalid requests |
| **SessionStart** | Initialize session | Load project context, set environment |
| **SessionEnd** | Cleanup on session close | Save state, cleanup temp files |
| **PreCompact** | Before context compaction | Preserve critical information |
| **Notification** | React to Claude notifications | Custom notification handling |

---

## Configuration

### Plugin Format (hooks/hooks.json)

```json
{
  "description": "Optional explanation",
  "hooks": {
    "PreToolUse": [...],
    "Stop": [...]
  }
}
```

### Settings Format (.claude/settings.json)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx tsx .claude/hooks/stop-validator.ts",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

---

## Input/Output

### Standard Input (JSON via stdin)

All hooks receive:

```json
{
  "session_id": "string",
  "transcript_path": "string",
  "cwd": "string",
  "permission_mode": "string",
  "hook_event_name": "string"
}
```

Event-specific fields:
- **PreToolUse/PostToolUse**: `tool_name`, `tool_input`
- **UserPromptSubmit**: `user_prompt`
- **Stop**: Current state info

### Standard Output

```json
{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "Optional context for Claude"
}
```

### Exit Codes

| Code | Meaning | Behavior |
|------|---------|----------|
| 0 | Success | JSON stdout is processed (decision, reason, continue fields) |
| 2 | Blocking error | JSON stdout is IGNORED, only stderr shown to Claude |
| Other | Non-blocking error | Hook failed, but doesn't block |

**IMPORTANT for Stop Hooks:** To make Claude CONTINUE working after a block, use exit(0) with `decision: "block"` in JSON. Exit code 2 ignores JSON, so Claude just stops instead of fixing issues.

---

## Environment Variables

Available in all command hooks:

| Variable | Description |
|----------|-------------|
| `$CLAUDE_PROJECT_DIR` | Project root directory |
| `$CLAUDE_PLUGIN_ROOT` | Plugin directory (for portability) |
| `$CLAUDE_ENV_FILE` | SessionStart persistence file |
| `$CLAUDE_CODE_REMOTE` | Remote execution flag |

---

## Matcher Patterns

Matchers determine which tools trigger hooks:

| Pattern | Example | Matches |
|---------|---------|---------|
| Exact | `"Write"` | Only Write tool |
| Multiple | `"Read\|Write\|Edit"` | Any of these tools |
| Wildcard | `"*"` | All tools |
| Regex | `"mcp__.*__delete.*"` | MCP delete operations |

---

## Best Practices

### Security

```typescript
// Always validate paths
if (filePath.includes('..') || filePath.startsWith('/etc')) {
  throw new Error('Path traversal blocked');
}

// Always quote variables in bash
const cmd = `cat "${filePath}"`; // Correct
const cmd = `cat ${filePath}`;   // WRONG - injection risk
```

### Performance

- All matching hooks execute **in parallel**
- Use command hooks for quick, deterministic checks
- Use prompt hooks for complex reasoning
- Default timeout: 60s (command), 30s (prompt)

### Error Handling

```typescript
// For Stop hooks - use JSON with decision: "block" + exit(0)
// This makes Claude CONTINUE working to fix the issues
if (validationFailed) {
  console.log(JSON.stringify({ decision: 'block', reason: errorMessage }));
  process.exit(0); // Must be 0 for JSON to be processed!
}

// For PreToolUse hooks - exit(2) blocks the specific tool operation
if (dangerousOperation) {
  process.stderr.write('BLOCKED: Dangerous operation');
  process.exit(2); // Blocks this tool call only
}

// For non-blocking warnings
if (warningCondition) {
  console.error('Warning:', message);
  process.exit(1); // Logs but doesn't block
}
```

---

## Stop Hook Template

```typescript
#!/usr/bin/env node
import { execSync } from 'child_process';

interface HookResult {
  decision: 'approve' | 'block';
  reason: string;
}

async function main(): Promise<void> {
  // Read stdin
  const stdin = await readStdin();
  const input = JSON.parse(stdin);

  // Validation logic
  const error = validateSomething();

  if (error) {
    // Block and make Claude CONTINUE working to fix the issue
    // IMPORTANT: Use exit(0) so JSON is processed. exit(2) ignores JSON!
    const result: HookResult = {
      decision: 'block',
      reason: `
ERROR: ${error.type}

${error.message}

REQUIRED ACTION:
  Task(subagent_type="${error.agent}", prompt="${error.prompt}")
`
    };
    console.log(JSON.stringify(result));
    process.exit(0); // Must be 0 for JSON to be processed!
  }

  // Success - allow task completion
  const result: HookResult = { decision: 'approve', reason: 'All checks passed' };
  console.log(JSON.stringify(result));
  process.exit(0);
}

main();
```

---

## PreToolUse Hook Template

```typescript
#!/usr/bin/env node
interface PreToolUseInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

async function main(): Promise<void> {
  const input: PreToolUseInput = JSON.parse(await readStdin());

  // Check if this is a dangerous operation
  if (input.tool_name === 'Write' && input.tool_input.file_path?.includes('.env')) {
    process.stderr.write('BLOCKED: Cannot write to .env files');
    process.exit(2);
  }

  // Allow operation
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}
```

---

## Debugging

**Important:** Hooks load at session startup. Config changes require restarting Claude Code.

```bash
# Debug hook execution
claude --debug

# View hook registration
claude --debug 2>&1 | grep -i hook
```

---

## Implementation Checklist

1. [ ] Identify target events (Stop, PreToolUse, etc.)
2. [ ] Choose hook type (prompt-based vs command)
3. [ ] Write configuration in settings.json
4. [ ] Create hook script with proper exit codes
5. [ ] Test with `claude --debug`
6. [ ] Document in project README

---

## Common Patterns

### Validation Gate (Stop Hook)

Check conditions before task completion:

```typescript
const validations = [
  checkBranch(),      // Must be on main
  checkGitClean(),    // No uncommitted changes
  checkDocumentation() // All files documented
];

const firstError = validations.find(v => v !== null);
if (firstError) {
  // Use JSON with decision: "block" + exit(0) so Claude CONTINUES fixing
  console.log(JSON.stringify({
    decision: 'block',
    reason: formatError(firstError)
  }));
  process.exit(0); // NOT exit(2) - that ignores JSON!
}
```

### Context Injection (UserPromptSubmit)

Add context to user prompts:

```typescript
const context = loadProjectContext();
const result = {
  continue: true,
  systemMessage: `Project context: ${context}`
};
console.log(JSON.stringify(result));
```

### Tool Blocking (PreToolUse)

Block dangerous operations:

```typescript
const BLOCKED_PATHS = ['.env', 'credentials', 'secrets'];
if (BLOCKED_PATHS.some(p => input.tool_input.path?.includes(p))) {
  process.stderr.write('Blocked: Cannot access sensitive files');
  process.exit(2);
}
```
