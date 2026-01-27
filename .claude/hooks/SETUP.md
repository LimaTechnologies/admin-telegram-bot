# Workflow Enforcement Hooks - Setup Guide

## Overview

This system provides agent selection guidance by analyzing prompts and suggesting the best agent for the task. It includes a **universal hook runner** that supports multiple runtimes with automatic fallback.

## Runtime Support

The hooks use a universal runner (`run-hook.ts`) that automatically detects and uses the first available runtime:

| Priority | Runtime | Extension | Notes                      |
| -------- | ------- | --------- | -------------------------- |
| 1        | python3 | .py       | Primary (user's preferred) |
| 2        | python  | .py       | Fallback                   |
| 3        | bun     | .ts       | TypeScript fallback        |
| 4        | npx tsx | .ts       | Final fallback             |

**If no runtime is available**, the hooks return a safe default (approve/continue) to avoid blocking the user.

## Files

| File                     | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `run-hook.ts`            | Universal runner with runtime detection       |
| `run-hook.sh`            | Shell wrapper for Unix/Linux/Mac              |
| `run-hook.cmd`           | Batch wrapper for Windows                     |
| `user-prompt-submit.py`  | Analyzes prompts and suggests agents (Python) |
| `user-prompt-submit.ts`  | Same as above (TypeScript fallback)           |
| `stop-validator.py`      | Validates before task completion (Python)     |
| `stop-validator.ts`      | Same as above (TypeScript fallback)           |
| `check-documentation.py` | Verifies file documentation (Python)          |

## Claude Code Configuration

The hooks are configured in `.claude/settings.json`:

```json
{
	"hooks": {
		"UserPromptSubmit": [
			{
				"matcher": "",
				"hooks": [
					{
						"type": "command",
						"command": "bun .claude/hooks/run-hook.ts user-prompt-submit",
						"timeout": 10
					}
				]
			}
		],
		"Stop": [
			{
				"hooks": [
					{
						"type": "command",
						"command": "bun .claude/hooks/run-hook.ts stop-validator",
						"timeout": 30
					}
				]
			}
		]
	}
}
```

## How It Works

1. Claude Code calls `bun .claude/hooks/run-hook.ts <hook-name>`
2. `run-hook.ts` checks for available runtimes in priority order
3. First available runtime executes the corresponding hook file (.py or .ts)
4. If no runtime is available, returns safe default to avoid blocking

## Environment Variables

| Variable             | Default       | Description            |
| -------------------- | ------------- | ---------------------- |
| `CLAUDE_PROJECT_DIR` | `os.getcwd()` | Project root directory |

## Troubleshooting

### Hooks not executing

1. Verify Bun is in PATH: `bun --version`
2. If Python is preferred, verify: `python3 --version` or `python --version`
3. Check `.claude/settings.json` hooks configuration
4. Ensure hook files exist in `.claude/hooks/`

### "python: not found" error

This error occurs when Python is not installed or not in PATH. The universal runner will automatically fallback to TypeScript hooks run by Bun.

**Solutions:**

1. **Install Python** (recommended for full functionality):
    - Windows: `winget install Python.Python.3.12` or download from python.org
    - Linux: `apt install python3` or `dnf install python3`
    - Mac: `brew install python3`

2. **Use Bun only** (already configured):
    - TypeScript fallback hooks are automatically used when Python is unavailable
    - No additional setup required

### Runtime detection failed

If you see `[run-hook] No runtime available`:

1. Ensure at least one runtime is installed: python3, python, bun, or Node.js
2. Verify the runtime is in your system PATH
3. For Bun: `curl -fsSL https://bun.sh/install | bash`
4. For Node.js (npx tsx): Install from nodejs.org

## Testing Hooks

Test the hook runner manually:

```bash
# Test with Bun
echo '{}' | bun .claude/hooks/run-hook.ts user-prompt-submit

# Test with Python (if available)
echo '{}' | python3 .claude/hooks/user-prompt-submit.py

# Test stop-validator
echo '{}' | bun .claude/hooks/run-hook.ts stop-validator
```
