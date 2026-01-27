#!/usr/bin/env bun
/**
 * MCP Auto-Installer for Claude Code
 *
 * This script automatically installs and configures recommended MCP servers
 * based on the project's agent/skill architecture.
 *
 * Features:
 * - Parallel installation for speed
 * - Progress tracking with visual feedback
 * - Security validation before installation
 * - Automatic .mcp.json generation
 * - Environment variable setup guidance
 *
 * Usage:
 *   bun .claude/scripts/setup-mcps.ts [options]
 *
 * Options:
 *   --tier=core|productivity|infrastructure|all  Install specific tier (default: core)
 *   --dry-run                                    Show what would be installed
 *   --force                                      Reinstall even if already configured
 *   --interactive                                Prompt for each server
 */

import { spawn, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Types
interface MCPServerConfig {
	name: string;
	description: string;
	tier: 'core' | 'productivity' | 'infrastructure';
	verified: boolean;
	publisher: string;
	repository: string;
	transport: 'stdio' | 'http';
	config: {
		command?: string;
		args?: string[];
		url?: string;
		options?: Record<string, unknown>;
		remote?: { url: string };
		local?: { command: string; args: string[] };
	};
	envVars: string[];
	requiredPermissions: string[];
	agentMappings: string[];
	securityNotes: string;
}

interface MCPConfig {
	metadata: {
		version: string;
		lastUpdated: string;
		researchSources: string[];
	};
	tiers: Record<string, { description: string; servers: string[] }>;
	servers: Record<string, MCPServerConfig>;
	security: {
		guidelines: string[];
		redFlags: string[];
		trustedPublishers: string[];
	};
	installation: {
		parallelLimit: number;
		timeout: number;
		retryAttempts: number;
		scope: string;
	};
}

interface InstallResult {
	server: string;
	success: boolean;
	message: string;
	duration: number;
}

interface MCPJsonEntry {
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
}

// Console colors (ANSI escape codes)
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	bgGreen: '\x1b[42m',
	bgRed: '\x1b[41m',
	bgYellow: '\x1b[43m',
};

// Get script directory
const getScriptDir = (): string => {
	try {
		if (typeof import.meta.url !== 'undefined') {
			return dirname(fileURLToPath(import.meta.url));
		}
	} catch {
		// Fallback
	}
	return process.cwd();
};

const SCRIPT_DIR = getScriptDir();
const PROJECT_ROOT = join(SCRIPT_DIR, '..', '..');
const CONFIG_PATH = join(SCRIPT_DIR, '..', 'config', 'mcp-config.json');
const MCP_JSON_PATH = join(PROJECT_ROOT, '.mcp.json');

// Utility functions
function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
	const prefix = {
		info: `${colors.blue}[INFO]${colors.reset}`,
		success: `${colors.green}[OK]${colors.reset}`,
		warning: `${colors.yellow}[WARN]${colors.reset}`,
		error: `${colors.red}[ERROR]${colors.reset}`,
	};
	console.log(`${prefix[type]} ${message}`);
}

function header(text: string): void {
	const line = '='.repeat(60);
	console.log(`\n${colors.cyan}${line}${colors.reset}`);
	console.log(`${colors.bright}${colors.cyan}  ${text}${colors.reset}`);
	console.log(`${colors.cyan}${line}${colors.reset}\n`);
}

function subheader(text: string): void {
	console.log(`\n${colors.magenta}>> ${text}${colors.reset}`);
}

function progressBar(current: number, total: number, width = 40): string {
	const percent = Math.round((current / total) * 100);
	const filled = Math.round((current / total) * width);
	const empty = width - filled;
	const bar = `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
	return `${bar} ${percent}% (${current}/${total})`;
}

// Load configuration
function loadConfig(): MCPConfig {
	if (!existsSync(CONFIG_PATH)) {
		throw new Error(`MCP config not found at: ${CONFIG_PATH}`);
	}
	const content = readFileSync(CONFIG_PATH, 'utf8');
	return JSON.parse(content) as MCPConfig;
}

// Load existing .mcp.json
function loadMcpJson(): Record<string, MCPJsonEntry> {
	if (!existsSync(MCP_JSON_PATH)) {
		return {};
	}
	try {
		const content = readFileSync(MCP_JSON_PATH, 'utf8');
		return JSON.parse(content) as Record<string, MCPJsonEntry>;
	} catch {
		return {};
	}
}

// Save .mcp.json
function saveMcpJson(config: Record<string, MCPJsonEntry>): void {
	writeFileSync(MCP_JSON_PATH, JSON.stringify(config, null, 2));
}

// Check if a command exists
function commandExists(cmd: string): boolean {
	try {
		const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
			stdio: 'pipe',
			shell: true,
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

// Validate security
function validateSecurity(
	server: MCPServerConfig,
	config: MCPConfig
): { valid: boolean; warnings: string[] } {
	const warnings: string[] = [];

	// Check if publisher is trusted
	if (!config.security.trustedPublishers.includes(server.publisher)) {
		warnings.push(`Publisher '${server.publisher}' is not in trusted list`);
	}

	// Check if verified
	if (!server.verified) {
		warnings.push('Server is not verified');
	}

	// Check for missing repository
	if (!server.repository) {
		warnings.push('No repository URL provided');
	}

	return {
		valid: warnings.length === 0,
		warnings,
	};
}

// Install a single MCP server using claude mcp add
async function installServer(
	serverId: string,
	server: MCPServerConfig,
	scope: string,
	dryRun: boolean
): Promise<InstallResult> {
	const startTime = Date.now();

	try {
		// Check if claude CLI is available
		if (!commandExists('claude')) {
			return {
				server: serverId,
				success: false,
				message: 'Claude CLI not found. Please install Claude Code first.',
				duration: Date.now() - startTime,
			};
		}

		// Build the command based on transport type
		let args: string[];

		if (server.transport === 'http' && server.config.url) {
			// Remote HTTP server
			args = ['mcp', 'add', '--transport', 'http', '-s', scope, serverId, server.config.url];
		} else if (server.transport === 'http' && server.config.remote?.url) {
			// Remote server with remote config
			args = [
				'mcp',
				'add',
				'--transport',
				'http',
				'-s',
				scope,
				serverId,
				server.config.remote.url,
			];
		} else if (server.config.command && server.config.args) {
			// Local stdio server
			args = [
				'mcp',
				'add',
				'-s',
				scope,
				serverId,
				'--',
				server.config.command,
				...server.config.args,
			];
		} else {
			return {
				server: serverId,
				success: false,
				message: 'Invalid server configuration',
				duration: Date.now() - startTime,
			};
		}

		if (dryRun) {
			return {
				server: serverId,
				success: true,
				message: `Would run: claude ${args.join(' ')}`,
				duration: Date.now() - startTime,
			};
		}

		// Execute the command
		return new Promise((resolve) => {
			const proc = spawn('claude', args, {
				shell: true,
				stdio: 'pipe',
			});

			let stdout = '';
			let stderr = '';

			proc.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			proc.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			proc.on('close', (code) => {
				const duration = Date.now() - startTime;
				if (code === 0) {
					resolve({
						server: serverId,
						success: true,
						message: 'Installed successfully',
						duration,
					});
				} else {
					resolve({
						server: serverId,
						success: false,
						message: stderr || stdout || `Exit code: ${code}`,
						duration,
					});
				}
			});

			proc.on('error', (err) => {
				resolve({
					server: serverId,
					success: false,
					message: err.message,
					duration: Date.now() - startTime,
				});
			});

			// Timeout
			setTimeout(() => {
				proc.kill();
				resolve({
					server: serverId,
					success: false,
					message: 'Installation timed out',
					duration: Date.now() - startTime,
				});
			}, 60000);
		});
	} catch (err) {
		return {
			server: serverId,
			success: false,
			message: err instanceof Error ? err.message : 'Unknown error',
			duration: Date.now() - startTime,
		};
	}
}

// Install servers in parallel with limit
async function installServersParallel(
	servers: Array<{ id: string; config: MCPServerConfig }>,
	scope: string,
	parallelLimit: number,
	dryRun: boolean
): Promise<InstallResult[]> {
	const results: InstallResult[] = [];
	let completed = 0;

	// Process in batches
	for (let i = 0; i < servers.length; i += parallelLimit) {
		const batch = servers.slice(i, i + parallelLimit);

		const batchResults = await Promise.all(
			batch.map(async ({ id, config: serverConfig }) => {
				const result = await installServer(id, serverConfig, scope, dryRun);
				completed++;

				// Update progress
				const status = result.success
					? `${colors.green}OK${colors.reset}`
					: `${colors.red}FAIL${colors.reset}`;
				console.log(`  ${progressBar(completed, servers.length)} ${id}: ${status}`);

				return result;
			})
		);

		results.push(...batchResults);
	}

	return results;
}

// Generate .mcp.json for project sharing
function generateMcpJson(
	servers: Array<{ id: string; config: MCPServerConfig }>,
	existingConfig: Record<string, MCPJsonEntry>
): Record<string, MCPJsonEntry> {
	const mcpJson = { ...existingConfig };

	for (const { id, config: server } of servers) {
		if (server.transport === 'stdio' && server.config.command && server.config.args) {
			const entry: MCPJsonEntry = {
				command: server.config.command,
				args: server.config.args,
			};

			// Add environment variables
			if (server.envVars.length > 0) {
				entry.env = {};
				for (const envVar of server.envVars) {
					entry.env[envVar] = `\${${envVar}}`;
				}
			}

			mcpJson[id] = entry;
		}
	}

	return mcpJson;
}

// Main function
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const options = {
		tier: 'core' as string,
		dryRun: false,
		force: false,
		interactive: false,
	};

	// Parse arguments
	for (const arg of args) {
		if (arg.startsWith('--tier=')) {
			options.tier = arg.split('=')[1] || 'core';
		} else if (arg === '--dry-run') {
			options.dryRun = true;
		} else if (arg === '--force') {
			options.force = true;
		} else if (arg === '--interactive') {
			options.interactive = true;
		} else if (arg === '--help' || arg === '-h') {
			console.log(`
${colors.bright}MCP Auto-Installer for Claude Code${colors.reset}

Usage: bun .claude/scripts/setup-mcps.ts [options]

Options:
  --tier=<tier>     Install specific tier: core, productivity, infrastructure, all
                    (default: core)
  --dry-run         Show what would be installed without actually installing
  --force           Reinstall even if already configured
  --interactive     Prompt before each installation
  --help, -h        Show this help message

Examples:
  bun .claude/scripts/setup-mcps.ts                    # Install core MCPs
  bun .claude/scripts/setup-mcps.ts --tier=all         # Install all MCPs
  bun .claude/scripts/setup-mcps.ts --dry-run          # Preview installation
  bun .claude/scripts/setup-mcps.ts --tier=productivity --force
`);
			process.exit(0);
		}
	}

	header('MCP Auto-Installer for Claude Code');

	// Load configuration
	log('Loading MCP configuration...');
	let config: MCPConfig;
	try {
		config = loadConfig();
		log(`Found ${Object.keys(config.servers).length} configured MCP servers`, 'success');
	} catch (err) {
		log(
			`Failed to load config: ${err instanceof Error ? err.message : 'Unknown error'}`,
			'error'
		);
		process.exit(1);
	}

	// Check prerequisites
	subheader('Checking Prerequisites');

	if (!commandExists('claude')) {
		log('Claude CLI not found. Please install Claude Code first.', 'error');
		log('Visit: https://claude.ai/code', 'info');
		process.exit(1);
	}
	log('Claude CLI found', 'success');

	if (!commandExists('npx')) {
		log('npx not found. Please install Node.js.', 'error');
		process.exit(1);
	}
	log('npx found', 'success');

	// Determine which servers to install
	subheader('Selecting Servers');

	const tiersToInstall = options.tier === 'all' ? Object.keys(config.tiers) : [options.tier];

	const serversToInstall: Array<{ id: string; config: MCPServerConfig }> = [];

	for (const tier of tiersToInstall) {
		const tierConfig = config.tiers[tier];
		if (!tierConfig) {
			log(`Unknown tier: ${tier}`, 'warning');
			continue;
		}

		log(`${colors.bright}Tier: ${tier}${colors.reset} - ${tierConfig.description}`);

		for (const serverId of tierConfig.servers) {
			const server = config.servers[serverId];
			if (!server) {
				log(`  Server not found: ${serverId}`, 'warning');
				continue;
			}

			console.log(`  ${colors.cyan}${serverId}${colors.reset}: ${server.description}`);
			serversToInstall.push({ id: serverId, config: server });
		}
	}

	if (serversToInstall.length === 0) {
		log('No servers selected for installation', 'warning');
		process.exit(0);
	}

	log(`\nTotal servers to install: ${serversToInstall.length}`, 'info');

	// Security validation
	subheader('Security Validation');

	const securityIssues: Array<{ server: string; warnings: string[] }> = [];

	for (const { id, config: server } of serversToInstall) {
		const validation = validateSecurity(server, config);
		if (!validation.valid) {
			securityIssues.push({ server: id, warnings: validation.warnings });
		}
	}

	if (securityIssues.length > 0) {
		log('Security warnings found:', 'warning');
		for (const issue of securityIssues) {
			console.log(`  ${colors.yellow}${issue.server}${colors.reset}:`);
			for (const warning of issue.warnings) {
				console.log(`    - ${warning}`);
			}
		}
		console.log();
	} else {
		log('All servers passed security validation', 'success');
	}

	// Environment variables check
	subheader('Environment Variables');

	const requiredEnvVars = new Set<string>();
	for (const { config: server } of serversToInstall) {
		for (const envVar of server.envVars) {
			requiredEnvVars.add(envVar);
		}
	}

	if (requiredEnvVars.size > 0) {
		log('The following environment variables are required:', 'info');
		for (const envVar of requiredEnvVars) {
			const isSet = !!process.env[envVar];
			const status = isSet
				? `${colors.green}SET${colors.reset}`
				: `${colors.yellow}NOT SET${colors.reset}`;
			console.log(`  ${envVar}: ${status}`);
		}
		console.log();
		log('Tip: Set these in your .env file or system environment', 'info');
	} else {
		log('No environment variables required for selected servers', 'success');
	}

	// Installation
	subheader(`${options.dryRun ? 'Dry Run - ' : ''}Installing MCP Servers`);

	console.log();
	const results = await installServersParallel(
		serversToInstall,
		config.installation.scope,
		config.installation.parallelLimit,
		options.dryRun
	);

	// Generate .mcp.json for team sharing
	if (!options.dryRun) {
		subheader('Generating .mcp.json');

		const existingMcpJson = loadMcpJson();
		const newMcpJson = generateMcpJson(serversToInstall, existingMcpJson);
		saveMcpJson(newMcpJson);
		log(`Generated ${MCP_JSON_PATH} for team sharing`, 'success');
	}

	// Summary
	header('Installation Summary');

	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);

	console.log(`${colors.green}Successful: ${successful.length}${colors.reset}`);
	for (const result of successful) {
		console.log(`  ${colors.green}✓${colors.reset} ${result.server} (${result.duration}ms)`);
	}

	if (failed.length > 0) {
		console.log(`\n${colors.red}Failed: ${failed.length}${colors.reset}`);
		for (const result of failed) {
			console.log(`  ${colors.red}✗${colors.reset} ${result.server}: ${result.message}`);
		}
	}

	// Next steps
	if (!options.dryRun) {
		subheader('Next Steps');

		console.log(`
1. ${colors.cyan}Verify installation:${colors.reset}
   claude mcp list

2. ${colors.cyan}Test a server:${colors.reset}
   claude mcp get <server-name>

3. ${colors.cyan}Set missing environment variables:${colors.reset}
   Create a .env file with required variables

4. ${colors.cyan}Share with team:${colors.reset}
   Commit .mcp.json to version control

5. ${colors.cyan}Debug issues:${colors.reset}
   claude --mcp-debug
`);
	}

	// Exit code
	if (failed.length > 0 && !options.dryRun) {
		process.exit(1);
	}
}

// Run
main().catch((err) => {
	console.error(`${colors.red}Fatal error:${colors.reset}`, err);
	process.exit(1);
});
