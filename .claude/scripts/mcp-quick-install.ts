#!/usr/bin/env bun
/**
 * MCP Quick Install Script
 *
 * Simplified installer for essential MCPs.
 * Run: bun .claude/scripts/mcp-quick-install.ts
 */

import { spawnSync } from 'child_process';

const CORE_MCPS = [
	{
		name: 'context7',
		desc: 'Real-time library documentation',
		cmd: 'claude mcp add -s user context7 -- npx -y @upstash/context7-mcp@latest',
	},
	{
		name: 'sequential-thinking',
		desc: 'Structured reasoning for complex problems',
		cmd: 'claude mcp add -s user sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking',
	},
	{
		name: 'memory',
		desc: 'Persistent context across sessions',
		cmd: 'claude mcp add -s user memory -- npx -y @modelcontextprotocol/server-memory',
	},
	{
		name: 'playwright',
		desc: 'Browser automation and E2E testing',
		cmd: 'claude mcp add -s user playwright -- npx -y @playwright/mcp@latest',
	},
];

const OPTIONAL_MCPS = [
	{
		name: 'nextjs-devtools',
		desc: 'Next.js development tools',
		cmd: 'claude mcp add -s user nextjs-devtools -- npx -y next-devtools-mcp@latest',
		requires: 'Next.js project',
	},
	{
		name: 'github',
		desc: 'GitHub repository management',
		cmd: 'claude mcp add --transport http -s user github https://api.githubcopilot.com/mcp/',
		requires: 'GITHUB_PERSONAL_ACCESS_TOKEN',
	},
	{
		name: 'mongodb',
		desc: 'MongoDB database operations',
		cmd: 'claude mcp add -s user mongodb -- npx -y @mongodb-js/mongodb-mcp-server',
		requires: 'MONGODB_URI',
	},
	{
		name: 'sentry',
		desc: 'Error tracking and monitoring',
		cmd: 'claude mcp add --transport http -s user sentry https://mcp.sentry.dev/mcp',
		requires: 'Sentry account',
	},
	{
		name: 'figma',
		desc: 'Design to code workflows',
		cmd: 'claude mcp add --transport http -s user figma https://mcp.figma.com/mcp',
		requires: 'Figma account',
	},
	{
		name: 'brave-search',
		desc: 'Web search for research',
		cmd: 'claude mcp add -s user brave-search -- npx -y @modelcontextprotocol/server-brave-search',
		requires: 'BRAVE_API_KEY',
	},
];

// Colors
const c = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	red: '\x1b[31m',
};

function run(cmd: string): boolean {
	const result = spawnSync(cmd, { shell: true, stdio: 'pipe' });
	return result.status === 0;
}

function install(name: string, cmd: string): boolean {
	process.stdout.write(`  Installing ${name}... `);
	const success = run(cmd);
	console.log(success ? `${c.green}OK${c.reset}` : `${c.red}FAILED${c.reset}`);
	return success;
}

async function main(): Promise<void> {
	console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════╗
║           MCP Quick Install for Claude Code                ║
╚═══════════════════════════════════════════════════════════╝${c.reset}
`);

	// Check Claude CLI
	if (!run('claude --version')) {
		console.log(`${c.red}Error: Claude CLI not found. Install Claude Code first.${c.reset}`);
		process.exit(1);
	}

	// Install core MCPs
	console.log(`${c.bright}${c.blue}Installing Core MCPs:${c.reset}\n`);

	let successCount = 0;
	let failCount = 0;

	for (const mcp of CORE_MCPS) {
		console.log(`${c.cyan}${mcp.name}${c.reset}: ${mcp.desc}`);
		if (install(mcp.name, mcp.cmd)) {
			successCount++;
		} else {
			failCount++;
		}
	}

	// Show optional MCPs
	console.log(`\n${c.bright}${c.yellow}Optional MCPs (install manually if needed):${c.reset}\n`);

	for (const mcp of OPTIONAL_MCPS) {
		console.log(`  ${c.cyan}${mcp.name}${c.reset}: ${mcp.desc}`);
		console.log(`    Requires: ${mcp.requires}`);
		console.log(`    Command: ${c.bright}${mcp.cmd}${c.reset}\n`);
	}

	// Summary
	console.log(`
${c.cyan}═══════════════════════════════════════════════════════════${c.reset}
${c.bright}Summary:${c.reset}
  ${c.green}Installed: ${successCount}${c.reset}
  ${failCount > 0 ? `${c.red}Failed: ${failCount}${c.reset}` : ''}

${c.bright}Next Steps:${c.reset}
  1. Verify: ${c.cyan}claude mcp list${c.reset}
  2. Test:   ${c.cyan}/mcp${c.reset} (inside Claude Code)
  3. Debug:  ${c.cyan}claude --mcp-debug${c.reset}

${c.bright}Documentation:${c.reset}
  .claude/skills/codebase-knowledge/domains/mcp-integration.md
${c.cyan}═══════════════════════════════════════════════════════════${c.reset}
`);
}

main();
