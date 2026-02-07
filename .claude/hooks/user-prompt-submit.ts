#!/usr/bin/env node
/**
 * UserPromptSubmit Hook
 *
 * Concise instructions injected before Claude processes each user prompt.
 * Enforces: todo-list creation, sequential execution, commit rules, CLAUDE.md update.
 */

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

		if (process.stdin.readableEnded) {
			clearTimeout(timeout);
			resolve('{}');
		}
	});
}

async function main(): Promise<void> {
	let hookInput: { user_prompt?: string; prompt?: string } = {};
	try {
		const stdin = await readStdinWithTimeout(1000);
		if (stdin && stdin.trim()) {
			hookInput = JSON.parse(stdin);
		}
	} catch {
		hookInput = {};
	}

	const prompt = hookInput.user_prompt || hookInput.prompt || '';
	if (!prompt.trim()) {
		console.log(JSON.stringify({ continue: true }));
		process.exit(0);
	}

	const today = new Date().toISOString().split('T')[0];

	const systemMessage = `TASK WORKFLOW (English only):

0. READ both CLAUDE.md (project root) and .claude/CLAUDE.md before making any changes. These contain project rules, architecture, and context you need.
1. CREATE a detailed todo-list (TaskCreate) breaking down the user's request into subtopics/steps.
2. WORK through each item sequentially — mark in_progress when starting, completed when done.
3. COMMIT using conventional commits (feat/fix/refactor/docs/chore). Use the commit-manager agent for proper git workflow: branch → implement → commit → merge to main.
4. UPDATE CLAUDE.md before finishing — this is the project's fast-recall memory across sessions:
   a. "## Last Change" section (date: ${today}, branch, summary). Keep only the latest, never stack.
   b. If you changed how the app works (new flows, changed workflows, new patterns): update the relevant CLAUDE.md sections (Architecture, Workflow, Rules, UI patterns, etc.) so the next session knows.
   c. If you added new rules, gotchas, or forbidden patterns: add them to the appropriate section.
   d. If you changed config, stack, or tooling: update the Stack/Configuration sections.
   CLAUDE.md is the single source of truth for quick context. Anything not recorded here will be forgotten next session.
5. RUN stop-validator before finishing: npx tsx .claude/hooks/stop-validator.ts`;

	console.log(JSON.stringify({ continue: true, systemMessage }));
	process.exit(0);
}

main().catch((err) => {
	console.error('Hook error:', err);
	console.log(JSON.stringify({ continue: true, systemMessage: 'Hook error, continuing...' }));
	process.exit(0);
});
