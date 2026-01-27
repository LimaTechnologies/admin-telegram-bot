#!/usr/bin/env node
/**
 * Stop Validator Hook - Complete Validation System
 *
 * THIS HOOK BLOCKS TASK COMPLETION IF ANY OF THESE CONDITIONS FAIL:
 *
 * 1. BRANCH CHECK: Must be on 'main' branch (work must be merged)
 * 2. GIT TREE CHECK: Working tree must be clean (no uncommitted changes)
 * 3. CLAUDE.MD CHECK: Must be updated with session changes
 * 4. CLAUDE.MD STRUCTURE: Must have required sections
 * 5. CLAUDE.MD SIZE: Must not exceed 40,000 characters
 * 6. DOCUMENTATION CHECK: All source files must be documented
 *
 * ERROR MESSAGES ARE DESCRIPTIVE: They guide the agent on exactly what to do.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_DIR = process.env['CLAUDE_PROJECT_DIR'] || process.cwd();
const CLAUDE_MD_PATH = join(PROJECT_DIR, 'CLAUDE.md');
const MAX_CHARACTERS = 40000;

const IGNORE_DIRS = new Set([
	'.next',
	'node_modules',
	'dist',
	'build',
	'coverage',
	'.git',
	'__pycache__',
	'.turbo',
	'.cache',
	'.husky',
	'packages',
]);

const IGNORE_PATTERNS = [
	'.lock',
	'.log',
	'.map',
	'.min.js',
	'.min.css',
	'package-lock.json',
	'bun.lockb',
	'.DS_Store',
	'Thumbs.db',
];

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst']);

const SOURCE_EXTENSIONS = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.py',
	'.go',
	'.rs',
	'.java',
	'.kt',
	'.swift',
	'.vue',
	'.svelte',
]);

// Required sections in CLAUDE.md
const REQUIRED_SECTIONS = [
	{ pattern: /^# .+/m, name: 'Project Title (H1)' },
	{ pattern: /^## Last Change/m, name: 'Last Change' },
	{ pattern: /^## 30 Seconds Overview/m, name: '30 Seconds Overview' },
	{ pattern: /^## Stack/m, name: 'Stack' },
	{ pattern: /^## Architecture/m, name: 'Architecture' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function shouldIgnoreFile(filePath: string): boolean {
	const parts = filePath.split(/[/\\]/);
	for (const part of parts) {
		if (IGNORE_DIRS.has(part)) return true;
	}
	for (const pattern of IGNORE_PATTERNS) {
		if (filePath.includes(pattern)) return true;
	}
	return false;
}

function isSourceFile(filePath: string): boolean {
	const ext = extname(filePath);
	return SOURCE_EXTENSIONS.has(ext) && !shouldIgnoreFile(filePath);
}

function getCurrentBranch(): string {
	try {
		return execSync('git rev-parse --abbrev-ref HEAD', {
			cwd: PROJECT_DIR,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();
	} catch {
		return 'unknown';
	}
}

function getModifiedFiles(): string[] {
	try {
		const staged = execSync('git diff --name-only --cached', {
			cwd: PROJECT_DIR,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		})
			.trim()
			.split('\n')
			.filter(Boolean);

		const unstaged = execSync('git diff --name-only', {
			cwd: PROJECT_DIR,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		})
			.trim()
			.split('\n')
			.filter(Boolean);

		const untracked = execSync('git ls-files --others --exclude-standard', {
			cwd: PROJECT_DIR,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		})
			.trim()
			.split('\n')
			.filter(Boolean);

		return [...new Set([...staged, ...unstaged, ...untracked])].filter(Boolean);
	} catch {
		return [];
	}
}

function* walkDir(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	const entries = readdirSync(dir);
	for (const entry of entries) {
		const fullPath = join(dir, entry);
		try {
			const stat = statSync(fullPath);
			if (stat.isDirectory()) {
				yield* walkDir(fullPath);
			} else if (stat.isFile()) {
				yield fullPath;
			}
		} catch {
			continue;
		}
	}
}

function searchInDocs(filePath: string): boolean {
	const fileName = basename(filePath);
	const fileStem = basename(filePath, extname(filePath));

	const docDirs = [
		join(PROJECT_DIR, 'docs'),
		join(PROJECT_DIR, '.claude', 'skills', 'codebase-knowledge', 'domains'),
	];

	for (const docDir of docDirs) {
		if (!existsSync(docDir)) continue;
		for (const docFile of walkDir(docDir)) {
			const ext = extname(docFile);
			if (!DOC_EXTENSIONS.has(ext)) continue;
			try {
				const content = readFileSync(docFile, 'utf8');
				if (
					content.includes(fileName) ||
					content.includes(fileStem) ||
					content.includes(filePath)
				) {
					return true;
				}
			} catch {
				continue;
			}
		}
	}
	return false;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

interface ValidationError {
	type: string;
	message: string;
	action: string;
}

function validateBranch(currentBranch: string, modifiedFiles: string[]): ValidationError | null {
	const isMainBranch = currentBranch === 'main' || currentBranch === 'master';

	// Case 1: On feature branch with changes - need to complete workflow
	if (!isMainBranch && modifiedFiles.length > 0) {
		return {
			type: 'FEATURE_BRANCH_NOT_MERGED',
			message: `Currently on branch '${currentBranch}' with uncommitted changes. The task cannot complete until work is merged to main.`,
			action: `
================================================================================
COMPLETE THE GIT WORKFLOW BEFORE TASK COMPLETION
================================================================================

You are on branch '${currentBranch}' with ${modifiedFiles.length} modified file(s).

REQUIRED STEPS (execute in order):

1. STAGE all changes:
   git add -A

2. COMMIT with conventional message:
   git commit -m "feat: description of changes"

3. SWITCH to main:
   git checkout main

4. MERGE branch:
   git merge ${currentBranch}

5. SYNC with remote (if exists):
   git pull origin main --rebase || true
   git push origin main || true

6. DELETE branch (cleanup):
   git branch -d ${currentBranch}

THEN the task can complete. The stop hook will verify main branch + clean tree.
================================================================================`,
		};
	}

	// Case 2: On feature branch with clean tree - just need to merge
	if (!isMainBranch && modifiedFiles.length === 0) {
		return {
			type: 'NOT_ON_MAIN_BRANCH',
			message: `Currently on branch '${currentBranch}'. Task completion requires being on 'main'.`,
			action: `
================================================================================
MERGE TO MAIN BRANCH
================================================================================

The working tree is clean but you're on branch '${currentBranch}'.

REQUIRED STEPS:

1. SWITCH to main:
   git checkout main

2. MERGE branch:
   git merge ${currentBranch}

3. SYNC with remote (if exists):
   git pull origin main --rebase || true
   git push origin main || true

4. DELETE branch (cleanup):
   git branch -d ${currentBranch}

IMPORTANT: Task completion is BLOCKED until you are on 'main' with a clean tree.
================================================================================`,
		};
	}

	// Case 3: On main with changes - FORBIDDEN
	if (isMainBranch && modifiedFiles.length > 0) {
		const fileList = modifiedFiles
			.slice(0, 10)
			.map((f) => `  - ${f}`)
			.join('\n');
		return {
			type: 'DIRECT_MAIN_COMMIT_FORBIDDEN',
			message: `CRITICAL: Attempting to work directly on '${currentBranch}' branch with changes!`,
			action: `
================================================================================
FORBIDDEN: DIRECT COMMITS TO MAIN
================================================================================

You have ${modifiedFiles.length} modified file(s) on main branch:
${fileList}${modifiedFiles.length > 10 ? '\n  ... and more' : ''}

ALL work MUST be done on feature branches. This is MANDATORY.

REQUIRED STEPS:

1. CREATE a feature branch:
   git checkout -b feature/your-feature-name
   (or fix/, refactor/, chore/, test/ as appropriate)

2. CONTINUE your work on the new branch

3. When done, merge back to main

NEVER commit directly to main. The stop hook will BLOCK this.
================================================================================`,
		};
	}

	return null; // All good - on main with clean tree
}

function validateGitTree(modifiedFiles: string[]): ValidationError | null {
	if (modifiedFiles.length === 0) return null;

	const fileList = modifiedFiles
		.slice(0, 15)
		.map((f) => `  - ${f}`)
		.join('\n');

	return {
		type: 'GIT_TREE_NOT_CLEAN',
		message: `Git working tree is not clean. Found ${modifiedFiles.length} modified/untracked file(s).`,
		action: `
================================================================================
GIT TREE MUST BE CLEAN FOR TASK COMPLETION
================================================================================

Modified files:
${fileList}${modifiedFiles.length > 15 ? '\n  ... and more' : ''}

The task cannot complete with uncommitted work.

OPTIONS:

1. COMMIT the changes (recommended):
   git add -A
   git commit -m "type: description"
   git push

2. STASH for later:
   git stash push -m "WIP: description"

3. DISCARD changes (use with caution):
   git checkout -- .
   git clean -fd

After cleaning the tree, the stop hook will pass.
================================================================================`,
	};
}

function validateClaudeMdExists(): ValidationError | null {
	if (!existsSync(CLAUDE_MD_PATH)) {
		return {
			type: 'CLAUDE_MD_MISSING',
			message: 'CLAUDE.md file not found at project root.',
			action: `
================================================================================
CLAUDE.MD IS REQUIRED
================================================================================

The project MUST have a CLAUDE.md file at the root with these sections:

# Project Name

## Last Change
**Branch:** branch-name
**Date:** YYYY-MM-DD
**Summary:** What was done in this session

## 30 Seconds Overview
Quick description of what this project does.

## Stack
| Component | Technology |
|-----------|------------|
| Runtime   | Bun        |
| Language  | TypeScript |
| Database  | MongoDB    |

## Architecture
Project structure and key directories.

CREATE this file before the task can complete.
================================================================================`,
		};
	}
	return null;
}

function validateClaudeMdSize(): ValidationError | null {
	if (!existsSync(CLAUDE_MD_PATH)) return null;

	const content = readFileSync(CLAUDE_MD_PATH, 'utf8');
	if (content.length <= MAX_CHARACTERS) return null;

	const excess = content.length - MAX_CHARACTERS;
	const percentOver = ((excess / MAX_CHARACTERS) * 100).toFixed(1);

	return {
		type: 'CLAUDE_MD_SIZE_EXCEEDED',
		message: `CLAUDE.md exceeds 40,000 character limit by ${excess} characters (${percentOver}% over).`,
		action: `
================================================================================
CLAUDE.MD MUST BE COMPACTED - RUN COMPACTOR AGENT (MANDATORY)
================================================================================

Current size: ${content.length} characters
Maximum allowed: ${MAX_CHARACTERS} characters
Excess: ${excess} characters (${percentOver}% over limit)

--------------------------------------------------------------------------------
REQUIRED ACTION: Run the claude-md-compactor agent
--------------------------------------------------------------------------------

  Task(subagent_type="claude-md-compactor", prompt="Compact CLAUDE.md to under 40k characters while preserving critical project knowledge")

The compactor agent will:
1. Research best practices via context7 and web search
2. Analyze current CLAUDE.md structure
3. Apply intelligent compaction rules:
   - Keep: Title, Last Change, Overview, Stack, Architecture, Rules
   - Remove: Verbose prose, old history, long examples, duplicates
4. Rewrite file in compact format
5. Validate final size < 40,000 chars

--------------------------------------------------------------------------------
COMPACTION PRIORITIES (agent follows these)
--------------------------------------------------------------------------------

MUST KEEP (max sizes):
  - # Project Title (1 line)
  - ## Last Change (200 chars, ONLY latest)
  - ## 30 Seconds Overview (300 chars)
  - ## Stack (500 chars, table only)
  - ## Architecture (800 chars, tree only)
  - ## Critical Rules (2000 chars, bullets)
  - ## FORBIDDEN (1000 chars, table)

MUST REMOVE:
  - Verbose explanations → bullet points
  - Code examples > 5 lines → file references
  - Old "Last Change" entries → git has history
  - Duplicate information → keep in one place
  - Long tables → header + 2 rows max

--------------------------------------------------------------------------------
MANUAL VERIFICATION (after agent runs)
--------------------------------------------------------------------------------

  wc -m CLAUDE.md  # Must show < 40000

================================================================================
The stop hook will BLOCK until CLAUDE.md is under 40,000 characters.
================================================================================`,
	};
}

function validateClaudeMdTemplateMerge(): ValidationError | null {
	const templatePath = join(PROJECT_DIR, '.claude', 'CLAUDE.template.md');

	// Only check if template exists (created by start-vibing when user has existing CLAUDE.md)
	if (!existsSync(templatePath)) return null;
	if (!existsSync(CLAUDE_MD_PATH)) return null;

	const userContent = readFileSync(CLAUDE_MD_PATH, 'utf8');
	const templateContent = readFileSync(templatePath, 'utf8');

	// Check if user's CLAUDE.md is missing required sections
	const missingSections: string[] = [];
	for (const section of REQUIRED_SECTIONS) {
		if (!section.pattern.test(userContent)) {
			missingSections.push(section.name);
		}
	}

	// If user has all required sections, they're probably fine - skip merge suggestion
	if (missingSections.length === 0) {
		return null; // User's CLAUDE.md is well-structured, no merge needed
	}

	return {
		type: 'CLAUDE_MD_TEMPLATE_MERGE_NEEDED',
		message: `Your CLAUDE.md is missing ${missingSections.length} required section(s). A template with recommended structure is available.`,
		action: `
================================================================================
SMART MERGE: COMBINE YOUR CLAUDE.MD WITH NEW TEMPLATE
================================================================================

Your CLAUDE.md is missing these sections:
${missingSections.map((s) => `  - ${s}`).join('\n')}

A template file exists at: .claude/CLAUDE.template.md

REQUIRED ACTION:
Perform a smart merge that:
1. KEEPS all your existing project-specific content
2. ADDS the missing required sections from the template
3. PRESERVES your custom rules and configurations

MERGE STEPS:
1. Read your current CLAUDE.md content
2. Read .claude/CLAUDE.template.md for structure reference
3. Create a merged version that:
   - Keeps your project title, overview, and custom rules
   - Adds missing sections (${missingSections.join(', ')})
   - Follows the template structure
4. Write the merged content to CLAUDE.md
5. Delete .claude/CLAUDE.template.md after successful merge

IMPORTANT: Do NOT just overwrite - intelligently MERGE the content!
After merging, delete the template file to mark merge as complete.
================================================================================`,
	};
}

function validateClaudeMdStructure(): ValidationError | null {
	if (!existsSync(CLAUDE_MD_PATH)) return null;

	const content = readFileSync(CLAUDE_MD_PATH, 'utf8');
	const missingSections: string[] = [];

	for (const section of REQUIRED_SECTIONS) {
		if (!section.pattern.test(content)) {
			missingSections.push(section.name);
		}
	}

	if (missingSections.length === 0) return null;

	return {
		type: 'CLAUDE_MD_MISSING_SECTIONS',
		message: `CLAUDE.md is missing required sections: ${missingSections.join(', ')}`,
		action: `
================================================================================
CLAUDE.MD MISSING REQUIRED SECTIONS
================================================================================

Missing sections:
${missingSections.map((s) => `  - ${s}`).join('\n')}

REQUIRED STRUCTURE:

# Project Name                    <- H1 title

## Last Change                    <- ONLY the most recent change
**Branch:** feature/xxx
**Date:** YYYY-MM-DD
**Summary:** What was done

## 30 Seconds Overview            <- Quick project description

## Stack                          <- Technology table

## Architecture                   <- Project structure

ADD the missing sections before the task can complete.
================================================================================`,
	};
}

function validateClaudeMdLastChange(): ValidationError | null {
	if (!existsSync(CLAUDE_MD_PATH)) return null;

	const content = readFileSync(CLAUDE_MD_PATH, 'utf8');
	const lastChangeMatch = content.match(/## Last Change\n([\s\S]*?)(?=\n## |$)/);

	if (!lastChangeMatch) return null; // Covered by structure check

	const lastChangeContent = lastChangeMatch[1].trim();

	// Check for meaningful content
	if (lastChangeContent.length < 50) {
		return {
			type: 'CLAUDE_MD_LAST_CHANGE_EMPTY',
			message: 'The "Last Change" section exists but lacks sufficient content.',
			action: `
================================================================================
UPDATE "LAST CHANGE" SECTION
================================================================================

The "## Last Change" section must contain:

**Branch:** the-branch-name-used
**Date:** ${new Date().toISOString().split('T')[0]}
**Summary:** 1-2 sentences describing what was changed/implemented

Example:
## Last Change

**Branch:** feature/add-auth
**Date:** 2025-01-05
**Summary:** Implemented JWT authentication with refresh tokens and session management.

IMPORTANT: This section should ONLY contain the LAST change, not a history.
================================================================================`,
		};
	}

	// Check for multiple Last Change sections (stacking is forbidden)
	const multipleChanges = content.match(/## Last Change/g);
	if (multipleChanges && multipleChanges.length > 1) {
		return {
			type: 'CLAUDE_MD_STACKED_CHANGES',
			message: `Found ${multipleChanges.length} "## Last Change" sections. Only ONE is allowed.`,
			action: `
================================================================================
REMOVE STACKED CHANGES - KEEP ONLY THE LATEST
================================================================================

Rule: CLAUDE.md should only have ONE "## Last Change" section.
Previous changes belong in git history, not in the documentation.

Found ${multipleChanges.length} instances of "## Last Change".

ACTION: Remove all but the most recent "## Last Change" section.

This keeps the file focused and within the 40k character limit.
================================================================================`,
		};
	}

	return null;
}

function validateClaudeMdUpdated(modifiedFiles: string[]): ValidationError | null {
	// Files that don't require CLAUDE.md update (auto-generated, locks, etc)
	const EXEMPT_PATTERNS = [
		'bun.lockb',
		'package-lock.json',
		'yarn.lock',
		'pnpm-lock.yaml',
		'.DS_Store',
		'Thumbs.db',
		/^packages\/start-vibing\/dist\//,
		/^packages\/start-vibing\/template\//,
	];

	// Filter out exempt files
	const significantFiles = modifiedFiles.filter((f) => {
		// Always exempt CLAUDE.md itself
		if (f === 'CLAUDE.md' || f.endsWith('/CLAUDE.md') || f.endsWith('\\CLAUDE.md')) {
			return false;
		}
		// Check exempt patterns
		for (const pattern of EXEMPT_PATTERNS) {
			if (typeof pattern === 'string') {
				if (f === pattern || f.includes(pattern)) return false;
			} else if (pattern.test(f)) {
				return false;
			}
		}
		return true;
	});

	// If no significant files modified, no need to check
	if (significantFiles.length === 0) return null;

	// Check if CLAUDE.md is in the modified files
	const claudeMdModified = modifiedFiles.some(
		(f) => f === 'CLAUDE.md' || f.endsWith('/CLAUDE.md') || f.endsWith('\\CLAUDE.md')
	);

	if (claudeMdModified) return null;

	return {
		type: 'CLAUDE_MD_NOT_UPDATED',
		message: `${significantFiles.length} file(s) were modified but CLAUDE.md was not updated.`,
		action: `
================================================================================
UPDATE CLAUDE.MD WITH SESSION CHANGES (MANDATORY)
================================================================================

You modified files but did not update CLAUDE.md.

Modified files:
${significantFiles
	.slice(0, 10)
	.map((f) => `  - ${f}`)
	.join('\n')}${significantFiles.length > 10 ? '\n  ... and more' : ''}

REQUIRED UPDATES TO CLAUDE.MD:

1. Update "## Last Change" section:
   **Branch:** current-branch-name
   **Date:** ${new Date().toISOString().split('T')[0]}
   **Summary:** What you implemented/fixed

2. If architecture changed:
   Update "## Architecture" section

3. If new patterns/rules were established:
   Add to appropriate section

4. If user mentioned preferences or corrections:
   Add as rules in relevant section

CONTEXT SYNTHESIS:
Think about what the user asked and what you learned.
Capture important decisions and patterns for the next session.

The stop hook will BLOCK until CLAUDE.md is updated.
================================================================================`,
	};
}

function validateDocumentation(sourceFiles: string[]): ValidationError | null {
	if (sourceFiles.length === 0) return null;

	const undocumented: string[] = [];
	for (const filePath of sourceFiles) {
		if (!searchInDocs(filePath)) {
			undocumented.push(filePath);
		}
	}

	if (undocumented.length === 0) return null;

	const fileList = undocumented
		.slice(0, 15)
		.map((f) => `  - ${f}`)
		.join('\n');

	return {
		type: 'SOURCE_FILES_NOT_DOCUMENTED',
		message: `${undocumented.length} source file(s) are not documented.`,
		action: `
================================================================================
DOCUMENT ALL MODIFIED SOURCE FILES (MANDATORY)
================================================================================

Undocumented files:
${fileList}${undocumented.length > 15 ? '\n  ... and more' : ''}

REQUIRED ACTION:

Run the documenter agent to update documentation:

  Task(subagent_type="documenter", prompt="Update documentation for all modified files")

The documenter will:
1. Detect changed files via git diff
2. Update domain files in .claude/skills/codebase-knowledge/domains/
3. Update docs/ as needed
4. Ensure all modified files are mentioned in documentation

A file is considered documented if its name appears in:
- docs/ folder
- .claude/skills/codebase-knowledge/domains/ folder

The stop hook will BLOCK until all source files are documented.
================================================================================`,
	};
}

interface DomainMapping {
	patterns: string[];
	description: string;
}

interface DomainMappingConfig {
	domains: Record<string, DomainMapping>;
}

function matchesGlobPattern(filePath: string, pattern: string): boolean {
	// Normalize path separators
	const normalizedPath = filePath.replace(/\\/g, '/');

	// Convert glob pattern to regex
	let regexPattern = pattern
		.replace(/\./g, '\\.') // Escape dots
		.replace(/\*\*/g, '<<<GLOBSTAR>>>') // Temp placeholder for **
		.replace(/\*/g, '[^/]*') // Single * matches anything except /
		.replace(/<<<GLOBSTAR>>>/g, '.*'); // ** matches anything including /

	// Handle patterns starting with **/ (match any path)
	if (regexPattern.startsWith('.*/')) {
		regexPattern = '(?:^|.*/?)' + regexPattern.slice(3);
	}

	try {
		const regex = new RegExp(regexPattern);
		return regex.test(normalizedPath);
	} catch {
		return false;
	}
}

function getDomainForFile(
	filePath: string,
	domains: Record<string, DomainMapping>
): string | null {
	for (const [domainName, domainConfig] of Object.entries(domains)) {
		for (const pattern of domainConfig.patterns) {
			if (matchesGlobPattern(filePath, pattern)) {
				return domainName;
			}
		}
	}
	return null;
}

function validateDomainDocumentation(modifiedFiles: string[]): ValidationError | null {
	const domainMappingPath = join(PROJECT_DIR, '.claude', 'config', 'domain-mapping.json');
	const domainsDir = join(PROJECT_DIR, '.claude', 'skills', 'codebase-knowledge', 'domains');

	// If domain-mapping.json doesn't exist, skip this check (project not configured)
	if (!existsSync(domainMappingPath)) {
		return null;
	}

	let domainConfig: DomainMappingConfig;
	try {
		const configContent = readFileSync(domainMappingPath, 'utf8');
		domainConfig = JSON.parse(configContent);
	} catch {
		return null; // Invalid config, skip check
	}

	// Filter for source files only (skip config, docs, etc.)
	const sourceFiles = modifiedFiles.filter(isSourceFile);
	if (sourceFiles.length === 0) return null;

	// Map files to their domains
	const fileToDomain: Record<string, string> = {};
	const unmappedFiles: string[] = [];
	const affectedDomains = new Set<string>();

	for (const file of sourceFiles) {
		const domain = getDomainForFile(file, domainConfig.domains);
		if (domain) {
			fileToDomain[file] = domain;
			affectedDomains.add(domain);
		} else {
			unmappedFiles.push(file);
		}
	}

	// Check which affected domains have NOT been updated
	const missingDomainUpdates: string[] = [];
	const domainFiles = modifiedFiles.filter(
		(f) => f.includes('codebase-knowledge/domains/') || f.includes('codebase-knowledge\\domains\\')
	);

	for (const domain of affectedDomains) {
		const domainFile = `${domain}.md`;
		const domainUpdated = domainFiles.some(
			(f) => f.endsWith(domainFile) || f.includes(`domains/${domain}.md`)
		);

		// Also check if domain file exists
		const domainPath = join(domainsDir, `${domain}.md`);
		const domainExists = existsSync(domainPath);

		if (!domainExists || !domainUpdated) {
			missingDomainUpdates.push(domain);
		}
	}

	// Build error message if issues found
	const issues: string[] = [];

	if (unmappedFiles.length > 0) {
		issues.push(`FILES NOT IN ANY DOMAIN (${unmappedFiles.length}):\n${unmappedFiles.map((f) => `  - ${f}`).join('\n')}`);
	}

	if (missingDomainUpdates.length > 0) {
		issues.push(`DOMAINS NOT UPDATED (${missingDomainUpdates.length}):\n${missingDomainUpdates.map((d) => `  - ${d}.md`).join('\n')}`);
	}

	if (issues.length === 0) return null;

	// Build file-to-domain mapping for display
	const mappingDisplay = Object.entries(fileToDomain)
		.slice(0, 10)
		.map(([file, domain]) => `  ${file} → ${domain}`)
		.join('\n');

	return {
		type: 'DOMAIN_DOCUMENTATION_INCOMPLETE',
		message: `Source files modified but domain documentation not properly updated.`,
		action: `
================================================================================
DOMAIN DOCUMENTATION REQUIRED (MANDATORY)
================================================================================

${issues.join('\n\n')}

FILE → DOMAIN MAPPING:
${mappingDisplay}${Object.keys(fileToDomain).length > 10 ? '\n  ... and more' : ''}

--------------------------------------------------------------------------------
REQUIRED ACTION: Run the documenter agent
--------------------------------------------------------------------------------

  Task(subagent_type="documenter", prompt="Update domain documentation for all modified files")

The documenter will:
1. Read .claude/config/domain-mapping.json for file patterns
2. Map each modified file to its domain
3. CREATE missing domain files in domains/
4. UPDATE existing domains with new files and commit info
5. Add connections between related domains

DOMAIN FILES LOCATION:
  .claude/skills/codebase-knowledge/domains/{domain-name}.md

EACH DOMAIN FILE MUST HAVE:
- Last Update (date, commit, summary)
- Files (all files in this domain)
- Connections (links to other domains)
- Recent Commits (history)
- Attention Points (gotchas)

================================================================================
The stop hook will BLOCK until domain documentation is complete.
================================================================================`,
	};
}

// ============================================================================
// MAIN HOOK LOGIC
// ============================================================================

interface HookInput {
	stop_hook_active?: boolean;
}

interface HookResult {
	continue: boolean;
	decision: 'approve' | 'block';
	reason: string;
}

/**
 * Maps error types to the subagent that should be launched to fix them.
 * IMPORTANT: Only use built-in Claude Code agent types that exist in the Task tool.
 * Custom agents defined in .claude/agents/ are NOT available as subagent_type.
 *
 * Available built-in types: general-purpose, documenter, commit-manager, branch-manager,
 * analyzer, tester, security-auditor, quality-checker, debugger, etc.
 */
const ERROR_TO_SUBAGENT: Record<string, { agent: string; prompt: string }> = {
	FEATURE_BRANCH_NOT_MERGED: {
		agent: 'commit-manager',
		prompt: 'Complete the git workflow: commit all changes, merge to main, sync with remote',
	},
	NOT_ON_MAIN_BRANCH: {
		agent: 'commit-manager',
		prompt: 'Merge current branch to main and checkout main',
	},
	DIRECT_MAIN_COMMIT_FORBIDDEN: {
		agent: 'branch-manager',
		prompt: 'Create a feature branch from the current changes on main',
	},
	GIT_TREE_NOT_CLEAN: {
		agent: 'commit-manager',
		prompt: 'Commit all pending changes with appropriate conventional commit message',
	},
	CLAUDE_MD_MISSING: {
		agent: 'documenter',
		prompt: 'Create CLAUDE.md with required sections: Last Change, 30s Overview, Stack, Architecture',
	},
	CLAUDE_MD_SIZE_EXCEEDED: {
		agent: 'general-purpose',
		prompt: `Compact CLAUDE.md to under 40,000 characters. Follow these rules from Anthropic best practices:

1. KEEP (critical): Title, Last Change (latest only), 30s Overview, Stack table, Architecture tree
2. REMOVE: Verbose prose (use bullets), code examples >5 lines (use file refs), duplicate info, old Last Change entries, commented sections
3. TARGET: <60 lines ideal, <300 max per HumanLayer research
4. CONDENSE: "Auth uses JWT via lib/auth.ts" instead of paragraphs explaining JWT

Read .claude/agents/07-documentation/claude-md-compactor.md for detailed compaction template.
Validate with: wc -m CLAUDE.md (must be < 40000)`,
	},
	CLAUDE_MD_TEMPLATE_MERGE_NEEDED: {
		agent: 'documenter',
		prompt: 'Merge existing CLAUDE.md with template in .claude/CLAUDE.template.md, then delete template',
	},
	CLAUDE_MD_MISSING_SECTIONS: {
		agent: 'documenter',
		prompt: 'Add missing required sections to CLAUDE.md',
	},
	CLAUDE_MD_LAST_CHANGE_EMPTY: {
		agent: 'documenter',
		prompt: 'Update the Last Change section in CLAUDE.md with current session info',
	},
	CLAUDE_MD_STACKED_CHANGES: {
		agent: 'documenter',
		prompt: 'Remove stacked Last Change sections in CLAUDE.md, keep only the latest',
	},
	CLAUDE_MD_NOT_UPDATED: {
		agent: 'documenter',
		prompt: 'Update CLAUDE.md Last Change section with current session summary',
	},
	SOURCE_FILES_NOT_DOCUMENTED: {
		agent: 'documenter',
		prompt: 'Update documentation for all modified source files',
	},
	DOMAIN_DOCUMENTATION_INCOMPLETE: {
		agent: 'documenter',
		prompt: 'Update domain documentation for all modified files in .claude/skills/codebase-knowledge/domains/',
	},
};

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

/**
 * Collect ALL validation errors in priority order.
 * Returns array of all errors found, empty if all passed.
 */
function collectAllErrors(
	currentBranch: string,
	modifiedFiles: string[],
	sourceFiles: string[],
	isMainBranch: boolean,
	_isCleanTree: boolean
): ValidationError[] {
	const errors: ValidationError[] = [];

	// 1. Branch validation - can't complete on feature branch
	const branchError = validateBranch(currentBranch, modifiedFiles);
	if (branchError) errors.push(branchError);

	// 2. Git tree - must be clean (only check if on main)
	if (isMainBranch) {
		const treeError = validateGitTree(modifiedFiles);
		if (treeError) errors.push(treeError);
	}

	// 3. CLAUDE.md must exist
	const claudeMdExistsError = validateClaudeMdExists();
	if (claudeMdExistsError) {
		errors.push(claudeMdExistsError);
		// If CLAUDE.md doesn't exist, skip other CLAUDE.md validations
		return errors;
	}

	// 4. Check if template merge is needed
	const templateMergeError = validateClaudeMdTemplateMerge();
	if (templateMergeError) errors.push(templateMergeError);

	// 5. CLAUDE.md size - must be under 40k
	const sizeError = validateClaudeMdSize();
	if (sizeError) errors.push(sizeError);

	// 6. CLAUDE.md structure - must have required sections
	const structureError = validateClaudeMdStructure();
	if (structureError) errors.push(structureError);

	// 7. Last Change must not be stacked
	const lastChangeError = validateClaudeMdLastChange();
	if (lastChangeError) errors.push(lastChangeError);

	// 8. CLAUDE.md must be updated if files changed
	const updatedError = validateClaudeMdUpdated(modifiedFiles);
	if (updatedError) errors.push(updatedError);

	// 9. Source files must be documented
	const docError = validateDocumentation(sourceFiles);
	if (docError) errors.push(docError);

	// 10. Domain documentation must be complete
	const domainDocError = validateDomainDocumentation(modifiedFiles);
	if (domainDocError) errors.push(domainDocError);

	return errors;
}

async function main(): Promise<void> {
	// Debug logging - writes to stderr (visible in claude debug mode)
	console.error('[stop-validator] Starting validation...');
	console.error(`[stop-validator] PROJECT_DIR: ${PROJECT_DIR}`);

	let hookInput: HookInput = {};
	try {
		const stdin = await readStdinWithTimeout(1000);
		if (stdin && stdin.trim()) {
			hookInput = JSON.parse(stdin);
		}
	} catch {
		hookInput = {};
	}

	// Prevent infinite loops
	if (hookInput.stop_hook_active) {
		const result: HookResult = {
			continue: false,
			decision: 'approve',
			reason: 'Stop hook cycle detected, allowing exit',
		};
		console.log(JSON.stringify(result));
		process.exit(0);
	}

	// Gather state
	const currentBranch = getCurrentBranch();
	const modifiedFiles = getModifiedFiles();
	const sourceFiles = modifiedFiles.filter(isSourceFile);
	const isMainBranch = currentBranch === 'main' || currentBranch === 'master';
	const isCleanTree = modifiedFiles.length === 0;

	console.error(`[stop-validator] Branch: ${currentBranch}, Modified: ${modifiedFiles.length}`);

	// Collect ALL errors to show summary
	const allErrors = collectAllErrors(
		currentBranch,
		modifiedFiles,
		sourceFiles,
		isMainBranch,
		isCleanTree
	);

	// ============================================================================
	// OUTPUT RESULTS - SHOW ALL ERRORS, DETAIL FIRST ONE
	// ============================================================================

	if (allErrors.length > 0) {
		const firstError = allErrors[0];
		const subagentInfo = ERROR_TO_SUBAGENT[firstError.type] || {
			agent: 'general-purpose',
			prompt: 'Fix the validation error',
		};

		// Build summary of ALL errors
		let errorSummary = '';
		for (let i = 0; i < allErrors.length; i++) {
			const err = allErrors[i];
			const status = i === 0 ? '→ FIXING NOW' : '  (pending)';
			errorSummary += `  ${i + 1}. [${err.type}] ${status}\n`;
		}

		// Build pending errors note (if more than 1)
		let pendingNote = '';
		if (allErrors.length > 1) {
			pendingNote = `
--------------------------------------------------------------------------------
REMAINING ISSUES (${allErrors.length - 1} more after this one)
--------------------------------------------------------------------------------

After fixing the first issue, run the validator again to see details for the next:

  Bash(command="npx tsx .claude/hooks/stop-validator.ts", description="Run validator to see next issue")

`;
		}

		const blockReason = `
================================================================================
STOP VALIDATOR - BLOCKED (${allErrors.length} issue${allErrors.length > 1 ? 's' : ''} found)
================================================================================

**FIRST**: Create a TODO LIST to track fixing all ${allErrors.length} issues:

  TodoWrite(todos=[
${allErrors.map((e, i) => `    { content: "Fix ${e.type}", status: "${i === 0 ? 'in_progress' : 'pending'}", activeForm: "Fixing ${e.type}" }`).join(',\n')}
  ])

--------------------------------------------------------------------------------
ALL ISSUES FOUND (in priority order)
--------------------------------------------------------------------------------

${errorSummary}
--------------------------------------------------------------------------------
ISSUE #1 DETAILS (fix this first)
--------------------------------------------------------------------------------

ERROR: ${firstError.type}

${firstError.message}

${firstError.action}

--------------------------------------------------------------------------------
FIX USING THIS SUBAGENT
--------------------------------------------------------------------------------

  Task(subagent_type="${subagentInfo.agent}", prompt="${subagentInfo.prompt}")
${pendingNote}
--------------------------------------------------------------------------------
WORKFLOW
--------------------------------------------------------------------------------

1. Create the TODO list above
2. Fix issue #1 using the subagent
3. Run: npx tsx .claude/hooks/stop-validator.ts
4. If more issues, repeat for each one
5. Only complete task when "ALL CHECKS PASSED"
================================================================================
`;

		// Stop hooks MUST return JSON with decision field
		// Exit code 2 signals blocking, but the JSON format is required for Stop hooks
		// continue: true tells Claude to KEEP WORKING after receiving this block
		const result: HookResult = { continue: true, decision: 'block', reason: blockReason.trim() };
		console.log(JSON.stringify(result));
		process.exit(0); // Must be 0 for JSON to be processed - exit 2 ignores JSON!
	}

	// All validations passed
	const successOutput = `
################################################################################
#                    STOP VALIDATOR - ALL CHECKS PASSED                        #
################################################################################

Branch: ${currentBranch}
Tree: ${isCleanTree ? 'Clean' : `${modifiedFiles.length} modified files`}
CLAUDE.md: Valid

All validations passed. Task may complete.
################################################################################
`;

	// continue: false tells Claude the task is DONE and can stop
	const result: HookResult = { continue: false, decision: 'approve', reason: successOutput.trim() };
	console.log(JSON.stringify(result));
	process.exit(0);
}

main().catch((err) => {
	console.error('Hook error:', err);
	// On error, allow to continue to not block user
	const result: HookResult = { continue: false, decision: 'approve', reason: 'Hook error, allowing by default' };
	console.log(JSON.stringify(result));
	process.exit(0);
});
