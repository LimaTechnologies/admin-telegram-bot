# Project Configuration

This directory contains project-specific configuration files that agents read to adapt their behavior to your project.

## Files

| File                  | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `project-config.json` | Main project configuration (stack, structure, commands) |
| `domain-mapping.json` | Maps file patterns to knowledge domains                 |
| `quality-gates.json`  | Quality check commands                                  |
| `testing-config.json` | Testing framework and conventions                       |
| `security-rules.json` | Security audit rules                                    |

## How Agents Use These

1. **analyzer** - Reads `project-config.json` for structure, `domain-mapping.json` for domains
2. **tester** - Reads `testing-config.json` for frameworks and conventions
3. **security-auditor** - Reads `security-rules.json` for security patterns
4. **quality-checker** - Reads `quality-gates.json` for commands
5. **domain-updater** - Reads `domain-mapping.json` for file-to-domain mapping

## Customizing for Your Project

1. Update `project-config.json` with your stack and commands
2. Update `domain-mapping.json` with your project structure
3. Update `testing-config.json` with your test conventions
4. Update `security-rules.json` with your auth framework

The agents will automatically adapt to your configuration.
