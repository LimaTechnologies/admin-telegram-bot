#!/usr/bin/env node
/**
 * UserPromptSubmit Hook - TypeScript version (fallback when Python not available)
 *
 * This hook runs BEFORE Claude processes any user prompt and ENFORCES:
 * 1. MANDATORY detailed todo list creation from prompt
 * 2. MANDATORY research agent for new features
 * 3. STRICT workflow: audit -> branch -> implement -> document -> quality -> merge to main
 * 4. Separate UI for mobile/tablet/desktop (NOT just responsive)
 *
 * AGENT SYSTEM: 82 specialized agents in 14 categories
 * SKILL SYSTEM: 22 skills auto-loaded by agents
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_DIR = process.env['CLAUDE_PROJECT_DIR'] || process.cwd();
const WORKFLOW_STATE_PATH = join(PROJECT_DIR, '.claude', 'workflow-state.json');

const STRICT_WORKFLOW = `
┌─────────────────────────────────────────────────────────────────┐
│                    STRICT WORKFLOW (MANDATORY)                  │
├─────────────────────────────────────────────────────────────────┤
│ 0. INIT TASK    → Run commit-manager to REGISTER task start    │
│ 1. TODO LIST    → Create DETAILED todo list from prompt        │
│ 2. RESEARCH     → Run research agent for NEW features          │
│ 3. AUDIT        → Check last audit docs OR run fresh audit     │
│ 4. BRANCH       → Create feature/ | fix/ | refactor/ | test/   │
│ 5. IMPLEMENT    → Follow rules + analyzer approval             │
│ 6. DOCUMENT     → Document ALL modified files (MANDATORY)      │
│ 7. UPDATE       → Update CLAUDE.md with session changes        │
│ 8. QUALITY      → typecheck + lint + test (Husky enforced)     │
│ 9. VALIDATE     → RUN: npx tsx .claude/hooks/stop-validator.ts │
│ 10. FINISH      → Only after "ALL CHECKS PASSED"               │
└─────────────────────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════════════════════╗
║  ⚠️  MANDATORY: RUN STOP VALIDATOR BEFORE COMPLETING ANY TASK   ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  COMMAND: npx tsx .claude/hooks/stop-validator.ts               ║
║                                                                 ║
║  YOU MUST run this command manually BEFORE saying "task done".  ║
║  Fix ALL issues one by one. Run validator again after EACH fix.║
║  Only complete task when output shows "ALL CHECKS PASSED".      ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝

⚠️  STOP HOOK BLOCKS task completion if:
    - NOT on main branch (work must be merged to main first)
    - Git tree NOT clean (all changes must be committed)
    - CLAUDE.md NOT updated (must reflect session changes)
    - CLAUDE.md missing required sections (Last Change, Stack, etc.)
    - CLAUDE.md exceeds 40,000 characters (must compact)
    - Source files NOT documented (must run documenter agent)
`;

// ============================================================================
// AGENT SYSTEM - 82 Specialized Agents in 14 Categories
// ============================================================================

interface AgentInfo {
	triggers: string[];
	when: string;
	skills: string[];
	can_veto?: boolean;
	mandatory_for?: string[];
}

interface CategoryInfo {
	description: string;
	agents: Record<string, AgentInfo>;
}

const AGENT_CATEGORIES: Record<string, CategoryInfo> = {
	'01-orchestration': {
		description: 'Workflow coordination and task management',
		agents: {
			orchestrator: {
				triggers: ['implement feature', 'build', 'create', 'full workflow', 'multi-step'],
				when: 'Task requires >2 agents or touches >3 files',
				skills: ['codebase-knowledge'],
			},
			'task-decomposer': {
				triggers: ['complex task', 'break down', 'multiple steps'],
				when: 'Task has >3 steps or touches >3 files',
				skills: ['codebase-knowledge'],
			},
			'workflow-router': {
				triggers: ['route', 'which agent', 'unclear'],
				when: 'At task start to route to correct agent',
				skills: ['codebase-knowledge'],
			},
			'parallel-coordinator': {
				triggers: ['parallel', 'concurrent', 'simultaneous'],
				when: 'Multiple independent agents should run simultaneously',
				skills: ['codebase-knowledge'],
			},
			'context-manager': {
				triggers: ['context', 'compress', 'long conversation'],
				when: 'Context grows large or between major phases',
				skills: ['codebase-knowledge'],
			},
			'checkpoint-manager': {
				triggers: ['checkpoint', 'save state', 'backup'],
				when: 'BEFORE risky operations (git, deletions, refactors)',
				skills: ['codebase-knowledge'],
			},
			'error-recovery': {
				triggers: ['failed', 'retry', 'timeout', 'unexpected error'],
				when: 'An agent fails or returns unexpected results',
				skills: ['codebase-knowledge', 'debugging-patterns'],
			},
			'agent-selector': {
				triggers: ['select agent', 'best agent', 'which agent'],
				when: 'Multiple agents could handle a task',
				skills: ['codebase-knowledge'],
			},
		},
	},
	'02-typescript': {
		description: 'TypeScript strict mode, types, and module resolution',
		agents: {
			'ts-strict-checker': {
				triggers: ['strict mode', 'null check', 'process.env'],
				when: 'AFTER editing any .ts file',
				skills: ['typescript-strict'],
			},
			'ts-types-analyzer': {
				triggers: ['type error', 'inference', 'generic problem'],
				when: 'On type errors or typecheck fails',
				skills: ['typescript-strict'],
			},
			'ts-generics-helper': {
				triggers: ['generic', 'type parameter', 'complex type'],
				when: 'Creating generic functions/types',
				skills: ['typescript-strict'],
			},
			'ts-migration-helper': {
				triggers: ['migrate', 'convert to typescript', '.js'],
				when: 'Migrating JavaScript to TypeScript',
				skills: ['typescript-strict'],
			},
			'type-definition-writer': {
				triggers: ['new model', 'new entity', 'interface needed'],
				when: 'BEFORE implementing new entities',
				skills: ['typescript-strict'],
			},
			'import-alias-enforcer': {
				triggers: ['import', 'alias', '@types'],
				when: 'AFTER editing .ts files - enforces $types/*, @common, @db',
				skills: ['typescript-strict'],
			},
			'esm-resolver': {
				triggers: ['module error', 'import error', 'cannot find module'],
				when: 'On module errors',
				skills: ['typescript-strict', 'bun-runtime'],
			},
			'bun-runtime-expert': {
				triggers: ['bun', 'runtime', 'package management'],
				when: 'Using Bun runtime',
				skills: ['bun-runtime'],
			},
			'zod-validator': {
				triggers: ['validation', 'zod', 'schema'],
				when: 'BEFORE commit when API routes exist',
				skills: ['zod-validation'],
			},
			'zod-schema-designer': {
				triggers: ['new endpoint', 'form input', 'user input'],
				when: 'BEFORE implementing any API endpoint',
				skills: ['zod-validation', 'typescript-strict'],
			},
		},
	},
	'03-testing': {
		description: 'Unit tests (Vitest) and E2E tests (Playwright)',
		agents: {
			'vitest-config': {
				triggers: ['test setup', 'vitest config', 'coverage config'],
				when: 'Setting up tests or coverage issues arise',
				skills: ['test-coverage'],
			},
			'tester-unit': {
				triggers: ['unit test', 'function test', 'utility test'],
				when: 'AFTER implementing any function or utility',
				skills: ['test-coverage'],
			},
			'tester-integration': {
				triggers: ['integration test', 'api test', 'service test'],
				when: 'AFTER implementing API endpoints or services',
				skills: ['test-coverage'],
			},
			'test-data-generator': {
				triggers: ['mock data', 'test fixture', 'factory'],
				when: 'BEFORE writing tests that need data',
				skills: ['test-coverage'],
			},
			'test-cleanup-manager': {
				triggers: ['flaky test', 'test isolation', 'state leakage'],
				when: 'Tests are flaky or share state',
				skills: ['test-coverage'],
			},
			'playwright-e2e': {
				triggers: ['e2e test', 'user flow', 'end to end'],
				when: 'AFTER implementing any user-facing feature',
				skills: ['test-coverage', 'playwright-automation'],
			},
			'playwright-fixtures': {
				triggers: ['fixture', 'shared setup', 'auth helper'],
				when: 'Creating E2E tests that need shared setup',
				skills: ['test-coverage', 'playwright-automation'],
			},
			'playwright-page-objects': {
				triggers: ['page object', 'page model', 'page interaction'],
				when: 'Creating E2E tests for new pages',
				skills: ['test-coverage', 'playwright-automation'],
			},
			'playwright-multi-viewport': {
				triggers: ['viewport', 'responsive test', 'mobile test'],
				when: 'AFTER any UI implementation - tests desktop/tablet/mobile',
				skills: ['test-coverage', 'playwright-automation'],
			},
			'playwright-assertions': {
				triggers: ['assertion', 'expect', 'test validation'],
				when: 'Creating comprehensive test assertions',
				skills: ['test-coverage', 'playwright-automation'],
			},
		},
	},
	'04-docker': {
		description: 'Docker containerization and deployment',
		agents: {
			'dockerfile-optimizer': {
				triggers: ['dockerfile', 'docker build', 'image size'],
				when: 'Creating or modifying Dockerfile',
				skills: ['docker-patterns'],
			},
			'docker-multi-stage': {
				triggers: ['multi-stage', 'build optimization', 'production docker'],
				when: 'Dockerfile can benefit from multi-stage',
				skills: ['docker-patterns'],
			},
			'docker-compose-designer': {
				triggers: ['docker-compose', 'multi-service', 'local dev'],
				when: 'Multi-service setup is needed',
				skills: ['docker-patterns'],
			},
			'docker-env-manager': {
				triggers: ['docker env', 'secrets', 'env vars'],
				when: 'Docker uses environment variables',
				skills: ['docker-patterns'],
			},
			'container-health': {
				triggers: ['health check', 'container monitoring', 'service health'],
				when: 'Creating Docker containers',
				skills: ['docker-patterns'],
			},
			'deployment-validator': {
				triggers: ['deploy', 'pre-deploy', 'docker validation'],
				when: 'BEFORE deploying',
				skills: ['docker-patterns'],
			},
		},
	},
	'05-database': {
		description: 'MongoDB/Mongoose database operations',
		agents: {
			'mongoose-schema-designer': {
				triggers: ['schema', 'model', 'collection'],
				when: 'BEFORE creating any database model',
				skills: ['mongoose-patterns'],
			},
			'mongoose-index-optimizer': {
				triggers: ['index', 'slow query', 'query performance'],
				when: 'Database queries are slow',
				skills: ['mongoose-patterns'],
			},
			'mongoose-aggregation': {
				triggers: ['aggregation', 'pipeline', 'reporting'],
				when: 'Complex data queries needed',
				skills: ['mongoose-patterns'],
			},
			'mongodb-query-optimizer': {
				triggers: ['n+1', 'query optimizer', 'database performance'],
				when: 'Queries are slow',
				skills: ['mongoose-patterns'],
			},
			'database-seeder': {
				triggers: ['seed', 'sample data', 'dev data'],
				when: 'Setting up development environment',
				skills: ['mongoose-patterns'],
			},
			'data-migration': {
				triggers: ['migration', 'schema change', 'data transform'],
				when: 'Schema changes are needed',
				skills: ['mongoose-patterns'],
			},
		},
	},
	'06-security': {
		description: 'Security auditing and OWASP compliance (CAN VETO)',
		agents: {
			'security-auditor': {
				triggers: ['security', 'audit', 'vulnerability'],
				when: 'BEFORE committing auth/user/API code',
				can_veto: true,
				skills: ['security-scan'],
			},
			'owasp-checker': {
				triggers: ['owasp', 'top 10', 'security review'],
				when: 'BEFORE committing any API or security code',
				can_veto: true,
				skills: ['security-scan'],
			},
			'input-sanitizer': {
				triggers: ['sanitize', 'user input', 'xss'],
				when: 'Handling user input',
				skills: ['security-scan', 'zod-validation'],
			},
			'auth-session-validator': {
				triggers: ['auth', 'session', 'login', 'jwt'],
				when: 'Implementing auth or session code',
				skills: ['security-scan'],
			},
			'permission-auditor': {
				triggers: ['permission', 'authorization', 'access control'],
				when: 'Implementing protected routes',
				skills: ['security-scan'],
			},
			'sensitive-data-scanner': {
				triggers: ['sensitive', 'pii', 'data leak'],
				when: 'Implementing API responses or logging',
				skills: ['security-scan'],
			},
		},
	},
	'07-documentation': {
		description: 'Documentation and domain knowledge updates',
		agents: {
			documenter: {
				triggers: ['document', 'docs', 'explain code'],
				when: 'AFTER any code implementation completes',
				skills: ['docs-tracker', 'codebase-knowledge'],
			},
			'domain-updater': {
				triggers: ['domain', 'learnings', 'session end'],
				when: 'BEFORE commit-manager at session end',
				skills: ['codebase-knowledge', 'docs-tracker'],
			},
			'readme-generator': {
				triggers: ['readme', 'project docs', 'setup guide'],
				when: 'Project structure changes significantly',
				skills: ['docs-tracker'],
			},
			'jsdoc-generator': {
				triggers: ['jsdoc', 'function docs', 'api docs'],
				when: 'Complex functions lack documentation',
				skills: ['docs-tracker', 'typescript-strict'],
			},
			'changelog-manager': {
				triggers: ['changelog', 'release notes', 'version'],
				when: 'BEFORE committing any feature or fix',
				skills: ['docs-tracker', 'git-workflow'],
			},
			'api-documenter': {
				triggers: ['api docs', 'swagger', 'openapi'],
				when: 'AFTER creating or modifying API endpoints',
				skills: ['docs-tracker'],
			},
		},
	},
	'08-git': {
		description: 'Git workflow and version control',
		agents: {
			'branch-manager': {
				triggers: ['branch', 'feature branch', 'fix branch'],
				when: 'BEFORE making source changes on main branch',
				skills: ['git-workflow'],
			},
			'commit-manager': {
				triggers: ['commit', 'push', 'finalize', 'merge'],
				when: 'FINAL AGENT when implementation is complete - commits and merges to main',
				skills: ['git-workflow', 'docs-tracker', 'codebase-knowledge'],
			},
		},
	},
	'09-quality': {
		description: 'Code quality and review',
		agents: {
			'quality-checker': {
				triggers: ['quality', 'typecheck', 'lint', 'build'],
				when: 'BEFORE any commit',
				skills: ['quality-gate', 'codebase-knowledge'],
			},
			'code-reviewer': {
				triggers: ['review', 'code review', 'code quality'],
				when: 'AFTER significant code is written',
				skills: ['quality-gate', 'codebase-knowledge'],
			},
		},
	},
	'10-research': {
		description: 'Web research and best practices (MANDATORY for new features)',
		agents: {
			'research-web': {
				triggers: ['search', 'find info', 'look up'],
				when: 'BEFORE implementing any new feature or technology',
				mandatory_for: ['feature'],
				skills: ['research-cache'],
			},
			'research-cache-manager': {
				triggers: ['cache', 'cached research', 'previous research'],
				when: 'BEFORE any web research',
				skills: ['research-cache'],
			},
			'best-practices-finder': {
				triggers: ['best practice', 'recommended', 'how should'],
				when: 'BEFORE implementing any new pattern',
				skills: ['research-cache'],
			},
			'pattern-researcher': {
				triggers: ['pattern', 'architecture', 'design decision'],
				when: 'Facing architectural decisions',
				skills: ['research-cache'],
			},
			'competitor-analyzer': {
				triggers: ['competitor', 'similar app', 'how does'],
				when: 'Designing UI or features with existing market solutions',
				skills: ['research-cache'],
			},
			'tech-evaluator': {
				triggers: ['compare', 'evaluate', 'which library'],
				when: 'Choosing between technologies',
				skills: ['research-cache'],
			},
		},
	},
	'11-ui-ux': {
		description: 'UI/UX - SEPARATE UIs for mobile/tablet/desktop (NOT just responsive)',
		agents: {
			'ui-mobile': {
				triggers: ['mobile', 'touch', '375px'],
				when: 'Implementing any UI feature',
				skills: ['ui-ux-audit', 'react-patterns', 'tailwind-patterns', 'shadcn-ui'],
			},
			'ui-tablet': {
				triggers: ['tablet', 'ipad', '768px'],
				when: 'Implementing any UI feature',
				skills: ['ui-ux-audit', 'react-patterns', 'tailwind-patterns', 'shadcn-ui'],
			},
			'ui-desktop': {
				triggers: ['desktop', 'sidebar', '1280px'],
				when: 'Implementing any UI feature',
				skills: ['ui-ux-audit', 'react-patterns', 'tailwind-patterns', 'shadcn-ui'],
			},
			'skeleton-generator': {
				triggers: ['skeleton', 'loading', 'placeholder'],
				when: 'AFTER creating any component that loads data',
				skills: ['react-patterns', 'tailwind-patterns'],
			},
			'design-system-enforcer': {
				triggers: ['design system', 'consistency', 'component style'],
				when: 'AFTER creating UI components',
				skills: ['ui-ux-audit', 'shadcn-ui', 'tailwind-patterns'],
			},
			'accessibility-auditor': {
				triggers: ['a11y', 'accessibility', 'wcag', 'screen reader'],
				when: 'AFTER any UI implementation',
				skills: ['ui-ux-audit'],
			},
		},
	},
	'12-performance': {
		description: 'Performance profiling and optimization',
		agents: {
			'performance-profiler': {
				triggers: ['slow', 'performance', 'profile', 'bottleneck'],
				when: 'Application is slow',
				skills: ['performance-patterns'],
			},
			'memory-leak-detector': {
				triggers: ['memory', 'leak', 'heap'],
				when: 'Memory issues are suspected',
				skills: ['performance-patterns'],
			},
			'bundle-analyzer': {
				triggers: ['bundle', 'build size', 'lighthouse'],
				when: 'Build is large or slow',
				skills: ['performance-patterns'],
			},
			'api-latency-analyzer': {
				triggers: ['api slow', 'response time', 'latency'],
				when: 'API endpoints are slow',
				skills: ['performance-patterns'],
			},
			'query-optimizer': {
				triggers: ['slow query', 'n+1', 'database slow'],
				when: 'Database queries are slow',
				skills: ['performance-patterns', 'mongoose-patterns'],
			},
			'render-optimizer': {
				triggers: ['re-render', 'react slow', 'component slow'],
				when: 'React components re-render excessively',
				skills: ['performance-patterns', 'react-patterns'],
			},
		},
	},
	'13-debugging': {
		description: 'Error analysis and debugging',
		agents: {
			debugger: {
				triggers: ['bug', 'error', 'not working', 'broken', 'fails'],
				when: 'Any bug or error occurs',
				skills: ['debugging-patterns'],
			},
			'type-error-resolver': {
				triggers: ['ts error', 'type error', 'typecheck fails'],
				when: 'On TypeScript type errors',
				skills: ['debugging-patterns', 'typescript-strict'],
			},
			'runtime-error-fixer': {
				triggers: ['crash', 'exception', 'runtime error'],
				when: 'On runtime crashes or exceptions',
				skills: ['debugging-patterns'],
			},
			'network-debugger': {
				triggers: ['fetch error', 'api error', 'cors', 'network'],
				when: 'On network or API errors',
				skills: ['debugging-patterns'],
			},
			'error-stack-analyzer': {
				triggers: ['stack trace', 'trace', 'call stack'],
				when: 'Error includes stack trace',
				skills: ['debugging-patterns'],
			},
			'build-error-fixer': {
				triggers: ['build failed', 'compile error', 'bundler error'],
				when: 'Build fails',
				skills: ['debugging-patterns'],
			},
		},
	},
	'14-validation': {
		description: 'Final validation before commit (CAN VETO)',
		agents: {
			'final-validator': {
				triggers: ['final check', 'validate', 'ready to commit'],
				when: 'BEFORE commit-manager - last check',
				can_veto: true,
				skills: ['final-check'],
			},
		},
	},
};

// ============================================================================
// SKILL SYSTEM - 22 Skills Auto-loaded by Agents
// ============================================================================

const SKILLS: Record<string, string> = {
	'bun-runtime': 'Bun runtime patterns, package management, scripts',
	'codebase-knowledge': 'Project domain knowledge, file mapping, recent commits',
	'debugging-patterns': 'Stack traces, runtime errors, build errors, network issues',
	'docker-patterns': 'Containerization, multi-stage builds, Docker Compose, security',
	'docs-tracker': 'Documentation maintenance, git diff detection, changelog',
	'final-check': 'Final validation, tests pass, docs updated, security audited',
	'git-workflow': 'Branch management, conventional commits, merge to main, hooks',
	'mongoose-patterns': 'MongoDB schema design, queries, indexes, aggregations',
	'nextjs-app-router': 'Next.js 15 App Router, Server/Client components, data fetching',
	'performance-patterns': 'React optimization, bundle analysis, memory leaks, API latency',
	'playwright-automation': 'E2E tests, browser automation, visual testing, API testing',
	'quality-gate': 'Quality checks (typecheck, lint, test, build)',
	'react-patterns': 'React 19 patterns, hooks, state management, performance',
	'research-cache': 'Cached research findings, best practices by topic',
	'security-scan': 'OWASP Top 10, user ID validation, sensitive data detection',
	'shadcn-ui': 'shadcn/ui components, customization, theming, accessibility',
	'tailwind-patterns': 'Tailwind CSS, responsive design, dark mode, animations',
	'test-coverage': 'Playwright E2E, Vitest unit tests, coverage tracking',
	'trpc-api': 'tRPC type-safe APIs, routers, procedures, middleware',
	'typescript-strict': 'TypeScript strict mode, index access, null checks, generics',
	'ui-ux-audit': 'UI/UX audits, competitor research, WCAG 2.1, responsiveness',
	'zod-validation': 'Zod schemas, input validation, type inference, error handling',
};

const WORKFLOWS: Record<string, string[]> = {
	feature: [
		'analyzer',
		'research-web',
		'ui-ux-reviewer',
		'documenter',
		'tester',
		'security-auditor',
		'quality-checker',
		'final-validator',
		'domain-updater',
		'commit-manager',
	],
	fix: [
		'debugger',
		'analyzer',
		'tester',
		'security-auditor',
		'quality-checker',
		'final-validator',
		'domain-updater',
		'commit-manager',
	],
	refactor: [
		'analyzer',
		'code-reviewer',
		'tester',
		'quality-checker',
		'final-validator',
		'domain-updater',
		'commit-manager',
	],
	config: ['quality-checker', 'domain-updater', 'commit-manager'],
};

interface WorkflowState {
	currentTask?: {
		id?: string;
		type?: string;
		description?: string;
		agents?: Record<string, { executed?: boolean }>;
		approvedFiles?: string[];
	};
}

function loadWorkflowState(): WorkflowState | null {
	if (!existsSync(WORKFLOW_STATE_PATH)) return null;
	try {
		return JSON.parse(readFileSync(WORKFLOW_STATE_PATH, 'utf8'));
	} catch {
		return null;
	}
}

function detectTaskType(prompt: string): string {
	const promptLower = prompt.toLowerCase();

	if (
		['bug', 'fix', 'error', 'broken', 'not working', 'issue', 'debug'].some((w) =>
			promptLower.includes(w)
		)
	) {
		return 'fix';
	} else if (
		['refactor', 'restructure', 'reorganize', 'clean up', 'improve'].some((w) =>
			promptLower.includes(w)
		)
	) {
		return 'refactor';
	} else if (
		['config', 'setting', 'env', 'package.json', 'tsconfig'].some((w) =>
			promptLower.includes(w)
		)
	) {
		return 'config';
	}
	return 'feature';
}

function detectBestAgents(prompt: string): Array<[string, string, string]> {
	const promptLower = prompt.toLowerCase();
	const matches: Array<[string, string, string]> = [];

	for (const [category, info] of Object.entries(AGENT_CATEGORIES)) {
		for (const [agentName, agentInfo] of Object.entries(info.agents)) {
			for (const trigger of agentInfo.triggers) {
				if (promptLower.includes(trigger)) {
					matches.push([category, agentName, `Matched '${trigger}'`]);
					break;
				}
			}
		}
	}

	matches.sort((a, b) => a[0].localeCompare(b[0]));

	if (matches.length === 0) {
		return [
			['01-orchestration', 'orchestrator', 'No specific trigger - orchestrator will analyze'],
		];
	}

	return matches.slice(0, 3);
}

function formatAgentCategories(): string {
	const lines: string[] = [];
	for (const [category, info] of Object.entries(AGENT_CATEGORIES).sort()) {
		const agentCount = Object.keys(info.agents).length;
		const vetoAgents = Object.entries(info.agents)
			.filter(([, a]) => a.can_veto)
			.map(([n]) => n);
		const vetoStr = vetoAgents.length > 0 ? ` [VETO: ${vetoAgents.join(', ')}]` : '';
		lines.push(`  ${category}: ${info.description} (${agentCount} agents)${vetoStr}`);
	}
	return lines.join('\n');
}

function formatSkills(): string {
	return Object.entries(SKILLS)
		.sort()
		.map(([name, desc]) => `  ${name}: ${desc}`)
		.join('\n');
}

function formatWorkflowStatus(state: WorkflowState | null): string {
	if (!state || !state.currentTask) {
		return 'STATUS: No active task. Start with orchestrator agent';
	}

	const task = state.currentTask;
	const agents = task.agents || {};

	const executed = Object.entries(agents)
		.filter(([, s]) => s.executed)
		.map(([n]) => n);
	const pending = Object.entries(agents)
		.filter(([, s]) => !s.executed)
		.map(([n]) => n);

	return `STATUS: Task active
  ID: ${task.id || 'unknown'}
  Type: ${task.type || 'unknown'}
  Description: ${task.description || 'unknown'}
  Executed: ${executed.length > 0 ? executed.join(', ') : 'none'}
  Pending: ${pending.length > 0 ? pending.join(', ') : 'none'}
  Approved files: ${(task.approvedFiles || []).length}`;
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
	const state = loadWorkflowState();
	const taskType = prompt ? detectTaskType(prompt) : 'unknown';
	const bestAgents = prompt
		? detectBestAgents(prompt)
		: [['01-orchestration', 'orchestrator', 'Default'] as [string, string, string]];

	const isNewFeature =
		taskType === 'feature' ||
		['new', 'implement', 'create', 'add'].some((w) => prompt.toLowerCase().includes(w));
	const isUiTask = [
		'ui',
		'component',
		'page',
		'design',
		'layout',
		'mobile',
		'desktop',
		'tablet',
	].some((w) => prompt.toLowerCase().includes(w));
	const isDebugTask = ['bug', 'error', 'broken', 'not working', 'debug', 'fix'].some((w) =>
		prompt.toLowerCase().includes(w)
	);

	const recommendedStr = bestAgents
		.map(([cat, agent, reason], i) => `    ${i + 1}. ${cat}/${agent} - ${reason}`)
		.join('\n');

	const claudeMdReminder = `
================================================================================
CLAUDE.MD UPDATE REQUIREMENT (MANDATORY)
================================================================================

Before completing ANY task, you MUST update CLAUDE.md at project root with:

1. "## Last Change" section (ONLY keep the latest, do NOT stack):
   **Branch:** your-branch-name
   **Date:** ${new Date().toISOString().split('T')[0]}
   **Summary:** What you implemented/fixed

2. Update "## Architecture" if structure changed

3. Add new rules/patterns learned to appropriate sections

4. SYNTHESIZE: If user mentioned preferences or corrections, add as rules

CHARACTER LIMIT: 40,000 max. If exceeded, COMPACT the file (keep critical sections).

STOP HOOK WILL BLOCK if CLAUDE.md is not properly updated!
================================================================================
`;

	const output = `
================================================================================
STRICT WORKFLOW ENFORCEMENT - UserPromptSubmit Hook
================================================================================
${STRICT_WORKFLOW}
${claudeMdReminder}

${isNewFeature ? '⚠️  NEW FEATURE DETECTED - RESEARCH AGENT IS MANDATORY!' : ''}
${isUiTask ? '⚠️  UI TASK DETECTED - SEPARATE UIs FOR MOBILE/TABLET/DESKTOP REQUIRED!' : ''}
${isDebugTask ? '🐛 DEBUG TASK DETECTED - Use debugger or type-error-resolver agents' : ''}

================================================================================
STEP 1: CREATE DETAILED TODO LIST (MANDATORY)
================================================================================

BEFORE doing anything, you MUST use TodoWrite to create a detailed todo list.
Break down the user's prompt into specific, actionable items.

================================================================================
AGENT SYSTEM: 82 Specialized Agents in 14 Categories
================================================================================

CATEGORIES:
${formatAgentCategories()}

TASK ANALYSIS:
  Detected type: ${taskType}
  Recommended agents:
${recommendedStr}
  Research required: ${isNewFeature ? 'YES (MANDATORY)' : 'Optional'}
  Separate UIs required: ${isUiTask ? 'YES (MANDATORY)' : 'N/A'}
  Workflow sequence: ${(WORKFLOWS[taskType] || WORKFLOWS['feature']).join(' -> ')}

${formatWorkflowStatus(state)}

================================================================================
SKILL SYSTEM: 22 Skills Auto-loaded by Agents
================================================================================

${formatSkills()}

Skills are auto-loaded when an agent starts. Agents don't inherit parent skills.

================================================================================
AGENT INVOCATION (VIA TASK TOOL ONLY)
================================================================================

You MUST use the Task tool with subagent_type to invoke agents.
DO NOT execute agent logic manually - INVOKE the agent properly.

Example:
  Task(subagent_type="debugger", prompt="Fix the TypeError in user.ts")
  Task(subagent_type="playwright-e2e", prompt="Create E2E tests for login")

================================================================================
`;

	const result = { continue: true, systemMessage: output };
	console.log(JSON.stringify(result));
	process.exit(0);
}

main().catch((err) => {
	console.error('Hook error:', err);
	const result = { continue: true, systemMessage: 'Hook error occurred, continuing...' };
	console.log(JSON.stringify(result));
	process.exit(0);
});
