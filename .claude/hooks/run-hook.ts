#!/usr/bin/env node
/**
 * Universal Hook Runner
 *
 * Runs hooks with multiple runtime fallbacks:
 * 1. bun (primary - fastest TypeScript execution)
 * 2. npx tsx (TypeScript fallback)
 * 3. python3 (Python fallback)
 * 4. python (Python fallback)
 *
 * IMPORTANT: TypeScript files are the source of truth.
 * Python files are only for environments without Node.js/Bun.
 *
 * Usage: npx tsx run-hook.ts <hook-name>
 * The hook-name should be without extension (e.g., "stop-validator")
 */

import { spawnSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get hooks directory - handle both ESM and CJS contexts
const getHooksDir = (): string => {
	try {
		if (typeof import.meta.url !== 'undefined') {
			return dirname(fileURLToPath(import.meta.url));
		}
	} catch {
		// Fallback for environments where import.meta is not available
	}
	return process.cwd();
};

const HOOKS_DIR = getHooksDir();

/**
 * Remove deprecated settings.local.json if it exists.
 * This file was previously tracked but should not be used anymore.
 * All hooks should use the universal runner via settings.json.
 */
function cleanupDeprecatedFiles(): void {
	const claudeDir = join(HOOKS_DIR, '..');
	const settingsLocalPath = join(claudeDir, 'settings.local.json');

	if (existsSync(settingsLocalPath)) {
		try {
			unlinkSync(settingsLocalPath);
			console.error('[run-hook] Removed deprecated settings.local.json');
		} catch {
			// Ignore errors - file may be locked or read-only
		}
	}
}

function checkRuntime(cmd: string): boolean {
	try {
		const result = spawnSync(cmd, ['--version'], {
			stdio: 'pipe',
			shell: true,
			timeout: 5000,
			windowsHide: true,
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

interface RuntimeResult {
	exitCode: number;
	output: string;
	error?: string;
}

function runWithRuntime(
	cmd: string,
	args: string[],
	input: string
): RuntimeResult {
	try {
		const result = spawnSync(cmd, args, {
			input,
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout: 30000,
			windowsHide: true,
			encoding: 'utf8',
		});

		return {
			exitCode: result.status ?? 1,
			output: result.stdout?.toString() || '',
			error: result.stderr?.toString() || undefined,
		};
	} catch (err) {
		return {
			exitCode: 1,
			output: '',
			error: err instanceof Error ? err.message : 'Unknown error',
		};
	}
}

async function runHook(hookName: string, stdinData: string): Promise<void> {
	const tsPath = join(HOOKS_DIR, `${hookName}.ts`);

	// Runtime detection order - TypeScript ONLY (source of truth)
	// Python files are deprecated and should be removed
	const runtimes: Array<{ name: string; cmd: string }> = [
		{ name: 'bun', cmd: 'bun' },
		{ name: 'npx-tsx', cmd: 'npx tsx' },
	];

	for (const runtime of runtimes) {
		if (!existsSync(tsPath)) {
			continue;
		}

		if (!checkRuntime(runtime.cmd.split(' ')[0])) {
			continue;
		}

		const result = runWithRuntime(runtime.cmd, [tsPath], stdinData);

		// Handle exit codes according to Claude Code hook specification:
		// - Exit code 0: Success (stdout in transcript)
		// - Exit code 2: Blocking error (stderr feeds back to Claude)
		// - Other: Non-blocking error

		if (result.exitCode === 0) {
			// Success - output stdout
			process.stdout.write(result.output);
			process.exit(0);
		} else if (result.exitCode === 2) {
			// Blocking error - for Stop hooks, JSON is in stdout
			// Pass through both stdout (JSON response) and stderr (debug logs)
			process.stdout.write(result.output);
			if (result.error) {
				process.stderr.write(result.error);
			}
			process.exit(2);
		} else {
			// Non-blocking error or runtime not found
			if (result.error?.includes('not found')) {
				// Runtime not available, try next
				continue;
			}
			// Hook failed but not blocking
			process.stdout.write(result.output);
			if (result.error) {
				process.stderr.write(result.error);
			}
			process.exit(result.exitCode);
		}
	}

	// No runtime available - return safe default
	console.error(`[run-hook] No runtime available to run hook: ${hookName}`);
	console.error('[run-hook] Please install bun or Node.js (for npx tsx)');
	const safeDefault = JSON.stringify({
		decision: 'approve',
		continue: true,
		reason: 'Hook runtime not available, allowing by default',
	});
	process.stdout.write(safeDefault);
	process.exit(0);
}

async function readStdinWithTimeout(timeoutMs: number): Promise<string> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			process.stdin.destroy();
			resolve('{}');
		}, timeoutMs);

		let data = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (chunk: string) => {
			data += chunk;
		});
		process.stdin.on('end', () => {
			clearTimeout(timeout);
			resolve(data || '{}');
		});
		process.stdin.on('error', () => {
			clearTimeout(timeout);
			resolve('{}');
		});

		// Handle case where stdin is empty/closed immediately
		if (process.stdin.readableEnded) {
			clearTimeout(timeout);
			resolve('{}');
		}
	});
}

// Main
async function main(): Promise<void> {
	// Log hook invocation for debugging (writes to stderr so it doesn't affect JSON output)
	const hookName = process.argv[2];
	const timestamp = new Date().toISOString();
	console.error(`[run-hook] ${timestamp} - Hook invoked: ${hookName || 'none'}`);

	// Clean up deprecated files on every hook run
	cleanupDeprecatedFiles();

	if (!hookName) {
		console.error('[run-hook] Usage: bun run-hook.ts <hook-name>');
		process.exit(1);
	}

	// Read stdin with timeout to avoid hanging
	const stdinData = await readStdinWithTimeout(2000);
	console.error(`[run-hook] ${hookName} - stdin received, length: ${stdinData.length}`);
	await runHook(hookName, stdinData);
}

main().catch((err) => {
	console.error('[run-hook] Fatal error:', err);
	// Return safe default on error
	const safeDefault = JSON.stringify({
		decision: 'approve',
		continue: true,
		reason: 'Hook runner error, allowing by default',
	});
	process.stdout.write(safeDefault);
	process.exit(0);
});
