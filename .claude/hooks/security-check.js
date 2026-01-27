/**
 * Hook de Seguranca Pre-Tool
 *
 * Este hook e executado ANTES de qualquer ferramenta ser chamada.
 * Sua funcao e bloquear acoes potencialmente perigosas.
 *
 * Baseado em: OpenSSF Security Guide for AI Code Assistants
 * https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions
 */

// Padroes perigosos que devem ser bloqueados
const DANGEROUS_PATTERNS = {
	// Comandos destrutivos
	commands: [
		/rm\s+-rf\s+[\/~]/i, // rm -rf com path perigoso
		/rm\s+-rf\s+\*/i, // rm -rf *
		/sudo\s+rm/i, // sudo rm
		/mkfs/i, // formatar disco
		/dd\s+if=/i, // dd (pode destruir dados)
		/>\s*\/dev\//i, // escrever em devices
		/chmod\s+777/i, // permissoes muito abertas
		/curl.*\|\s*(ba)?sh/i, // curl pipe to shell
		/wget.*\|\s*(ba)?sh/i, // wget pipe to shell
	],

	// Padroes de codigo inseguro
	code: [
		/eval\s*\(/i, // eval()
		/new\s+Function\s*\(/i, // new Function()
		/innerHTML\s*=/i, // innerHTML assignment (XSS)
		/document\.write\s*\(/i, // document.write (XSS)
		/dangerouslySetInnerHTML/i, // React dangerous prop
		/\$\{.*\}\s*\)/i, // Template injection em queries
	],

	// Exposicao de dados sensiveis
	sensitive: [
		/password\s*[:=]/i, // Senha hardcoded
		/api[_-]?key\s*[:=]/i, // API key hardcoded
		/secret\s*[:=]/i, // Secret hardcoded
		/private[_-]?key/i, // Private key
		/BEGIN\s+(RSA|DSA|EC)\s+PRIVATE/i, // Chave privada PEM
	],

	// Patterns especificos do projeto
	project: [
		/userId.*req\.body/i, // userId do request body
		/userId.*input\./i, // userId do input tRPC
		/findById\(.*input/i, // Query sem validacao de owner
		/z\.any\(\)/i, // Zod any (sem validacao)
	],
};

// Arquivos que nao devem ser modificados
const PROTECTED_FILES = ['.env', '.env.local', '.env.production', '.env.development', 'bun.lockb'];

// Diretorios que nao devem ser acessados
const PROTECTED_DIRS = ['/etc', '/var', '/usr', '/root', '/home', 'node_modules', '.git/objects'];

/**
 * Verifica se um comando/codigo contem padroes perigosos
 * @param {string} content - Conteudo a verificar
 * @param {string} category - Categoria de padroes
 * @returns {Object} - { blocked: boolean, reason: string }
 */
function checkDangerousPatterns(content, category) {
	const patterns = DANGEROUS_PATTERNS[category] || [];

	for (const pattern of patterns) {
		if (pattern.test(content)) {
			return {
				blocked: true,
				reason: `Padrao perigoso detectado: ${pattern.toString()}`,
				category,
			};
		}
	}

	return { blocked: false };
}

/**
 * Verifica se um arquivo e protegido
 * @param {string} filePath - Caminho do arquivo
 * @returns {boolean}
 */
function isProtectedFile(filePath) {
	return PROTECTED_FILES.some(
		(protected) => filePath.endsWith(protected) || filePath.includes(protected)
	);
}

/**
 * Verifica se um diretorio e protegido
 * @param {string} dirPath - Caminho do diretorio
 * @returns {boolean}
 */
function isProtectedDir(dirPath) {
	return PROTECTED_DIRS.some(
		(protected) => dirPath.startsWith(protected) || dirPath.includes(protected)
	);
}

/**
 * Hook principal - executado antes de cada tool call
 * @param {Object} toolCall - Dados da chamada de ferramenta
 * @returns {Object} - { allowed: boolean, reason?: string }
 */
function preToolHook(toolCall) {
	const { name, args } = toolCall;

	// Verificar comandos bash
	if (name === 'bash' && args.command) {
		const result = checkDangerousPatterns(args.command, 'commands');
		if (result.blocked) {
			return {
				allowed: false,
				reason: `Comando bloqueado: ${result.reason}`,
			};
		}
	}

	// Verificar escrita de arquivos
	if (['file_write', 'file_edit'].includes(name)) {
		// Verificar arquivo protegido
		if (args.path && isProtectedFile(args.path)) {
			return {
				allowed: false,
				reason: `Arquivo protegido: ${args.path}`,
			};
		}

		// Verificar conteudo perigoso
		if (args.content) {
			const codeResult = checkDangerousPatterns(args.content, 'code');
			if (codeResult.blocked) {
				return {
					allowed: false,
					reason: `Codigo inseguro: ${codeResult.reason}`,
				};
			}

			const sensitiveResult = checkDangerousPatterns(args.content, 'sensitive');
			if (sensitiveResult.blocked) {
				return {
					allowed: false,
					reason: `Dados sensiveis detectados: ${sensitiveResult.reason}`,
				};
			}

			const projectResult = checkDangerousPatterns(args.content, 'project');
			if (projectResult.blocked) {
				return {
					allowed: false,
					reason: `Violacao de regra do projeto: ${projectResult.reason}`,
				};
			}
		}
	}

	// Verificar leitura de diretorios protegidos
	if (name === 'file_read' && args.path) {
		if (isProtectedDir(args.path)) {
			return {
				allowed: false,
				reason: `Diretorio protegido: ${args.path}`,
			};
		}
	}

	// Permitir por padrao
	return { allowed: true };
}

/**
 * Log de seguranca para auditoria
 * @param {string} action - Acao tomada
 * @param {Object} details - Detalhes
 */
function logSecurityEvent(action, details) {
	const timestamp = new Date().toISOString();
	const logEntry = {
		timestamp,
		action,
		...details,
	};

	// Em producao, enviar para sistema de logging
	console.log('[SECURITY]', JSON.stringify(logEntry));
}

// Exportar para uso pelo SDK
module.exports = {
	preToolHook,
	checkDangerousPatterns,
	isProtectedFile,
	isProtectedDir,
	logSecurityEvent,
	DANGEROUS_PATTERNS,
	PROTECTED_FILES,
	PROTECTED_DIRS,
};
