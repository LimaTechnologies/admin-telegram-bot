#!/bin/bash
# Universal Hook Runner for Unix/Linux/Mac
# Tries: python3 -> python -> bun -> npx tsx

HOOK_NAME="$1"
HOOKS_DIR="$(dirname "$0")"

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Try Python3 first
if command_exists python3; then
    if [ -f "$HOOKS_DIR/$HOOK_NAME.py" ]; then
        exec python3 "$HOOKS_DIR/$HOOK_NAME.py"
    fi
fi

# Try Python
if command_exists python; then
    if [ -f "$HOOKS_DIR/$HOOK_NAME.py" ]; then
        exec python "$HOOKS_DIR/$HOOK_NAME.py"
    fi
fi

# Try Bun with TypeScript
if command_exists bun; then
    if [ -f "$HOOKS_DIR/$HOOK_NAME.ts" ]; then
        exec bun "$HOOKS_DIR/$HOOK_NAME.ts"
    fi
fi

# Try npx tsx as final fallback
if command_exists npx; then
    if [ -f "$HOOKS_DIR/$HOOK_NAME.ts" ]; then
        exec npx tsx "$HOOKS_DIR/$HOOK_NAME.ts"
    fi
fi

# No runtime available - return safe default
echo '{"decision":"approve","reason":"No runtime available for hook, allowing by default"}'
exit 0
