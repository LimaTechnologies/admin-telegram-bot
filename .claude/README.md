# Configuracao de Agentes - AI Builder

Este diretorio contem a configuracao completa do sistema de agentes
para o fluxo de desenvolvimento do AI Builder.

---

## Estrutura

```
.claude/
├── CLAUDE.md              # Contexto geral para agentes
├── settings.json          # Configuracoes globais
├── README.md              # Este arquivo
│
├── agents/                # Subagentes especializados
│   ├── orchestrator.md    # Coordena o fluxo
│   ├── analyzer.md        # Analisa impacto
│   ├── documenter.md      # Cria documentacao
│   ├── tester.md          # Cria e executa testes
│   ├── security-auditor.md # Audita seguranca
│   ├── ui-ux-reviewer.md  # Revisa UI/UX
│   ├── quality-checker.md # Verifica qualidade
│   └── final-validator.md # Validacao final
│
├── hooks/                 # Hooks de seguranca
│   └── security-check.js  # Bloqueia acoes perigosas
│
└── commands/              # Slash commands customizados
    ├── feature.md         # /feature - nova feature
    ├── fix.md             # /fix - corrigir bug
    ├── validate.md        # /validate - validacao completa
    └── research.md        # /research - pesquisar topico
```

---

## Agentes

### Hierarquia

```
                    ┌─────────────────┐
                    │  ORCHESTRATOR   │
                    │  (coordenador)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │ANALYZER │          │ TESTER  │          │ UI/UX   │
   │(impacto)│          │(testes) │          │REVIEWER │
   └─────────┘          └─────────┘          └─────────┘
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │DOCUMENT │          │SECURITY │          │ QUALITY │
   │  ER     │          │ AUDITOR │          │ CHECKER │
   └─────────┘          └─────────┘          └─────────┘
                             │
                    ┌────────▼────────┐
                    │ FINAL VALIDATOR │
                    │  (veto power)   │
                    └─────────────────┘
```

### Funcoes

| Agente           | Funcao                           | Pesquisa?                               | Pode Vetar? |
| ---------------- | -------------------------------- | --------------------------------------- | ----------- |
| orchestrator     | Coordena fluxo, delega tarefas   | **SIM** - best practices gerais         | Nao         |
| analyzer         | Analisa impacto de mudancas      | **SIM** - arquitetura, migracoes        | Nao         |
| documenter       | Cria/atualiza documentacao       | **SIM** - padroes de docs               | Nao         |
| tester           | Cria e executa testes            | **SIM** - padroes de teste, edge cases  | Nao         |
| security-auditor | Valida seguranca                 | **SIM** - OWASP, CVEs, vulnerabilidades | **SIM**     |
| ui-ux-reviewer   | Pesquisa competidores, valida UI | **SIM** - competidores, UX, WCAG        | Nao         |
| quality-checker  | Roda typecheck/lint/build        | **SIM** - solucoes para erros           | Nao         |
| final-validator  | Checklist final completo         | **SIM** - valida que outros pesquisaram | **SIM**     |

### TODOS os Agentes Pesquisam

Cada agente tem a obrigacao de pesquisar best practices antes de agir:

```
orchestrator    → Pesquisa padroes de arquitetura e implementacao
analyzer        → Pesquisa riscos e migracoes
documenter      → Pesquisa padroes de documentacao
tester          → Pesquisa edge cases e padroes de teste
security-auditor → Pesquisa OWASP, CVEs, vulnerabilidades conhecidas
ui-ux-reviewer  → Pesquisa competidores, UX patterns, WCAG
quality-checker → Pesquisa solucoes para erros encontrados
final-validator → Valida que TODOS os outros pesquisaram
```

---

## Fluxos

### Feature Completa (default_flow)

```
1. analyzer         → Analisa impacto
2. ui-ux-reviewer   → Pesquisa competidores (se UI)
3. documenter       → Documenta fluxo
4. [IMPLEMENTACAO]
5. tester           → Cria testes
6. security-auditor → Valida seguranca
7. quality-checker  → typecheck + lint + build
8. final-validator  → Checklist final
9. [COMMIT]
```

### Bug Fix (bug_fix_flow)

```
1. analyzer         → Identifica causa raiz
2. [IMPLEMENTACAO]
3. tester           → Cria teste de regressao
4. security-auditor → Valida que fix nao introduz vuln
5. quality-checker  → typecheck + lint + build
6. final-validator  → Checklist adaptado
7. [COMMIT]
```

### Refactor (refactor_flow)

```
1. analyzer         → Mapeia dependencias
2. [IMPLEMENTACAO]
3. tester           → Atualiza testes
4. security-auditor → Valida seguranca
5. quality-checker  → typecheck + lint + build
6. final-validator  → Checklist adaptado
7. [COMMIT]
```

### Config/Chore (config_flow)

```
1. quality-checker  → Apenas qualidade
2. [COMMIT]
```

---

## Comandos

| Comando     | Descricao           | Uso                       |
| ----------- | ------------------- | ------------------------- |
| `/feature`  | Inicia nova feature | `/feature [descricao]`    |
| `/fix`      | Corrige bug         | `/fix [descricao do bug]` |
| `/validate` | Validacao completa  | `/validate`               |
| `/research` | Pesquisa topico     | `/research [topico]`      |

---

## Hooks

### security-check.js

Executado ANTES de cada tool call. Bloqueia:

- Comandos destrutivos (`rm -rf`, `sudo`, etc)
- Codigo inseguro (`eval()`, `innerHTML`, etc)
- Dados sensiveis hardcoded (passwords, API keys)
- Violacoes de regras do projeto (userId do request, z.any(), etc)

---

## Como Usar

### No Claude Code (Interativo)

Os agentes sao carregados automaticamente quando voce abre o projeto.
O orchestrator coordena o fluxo baseado no tipo de tarefa.

### Com Claude Agent SDK (Programatico)

```python
from claude_agent_sdk import ClaudeSDKClient

client = ClaudeSDKClient(
    setting_sources=["project"]  # Carrega .claude/settings.json
)

result = await client.query("Implementar feature X")
```

---

## Regras Garantidas pelos Agentes

1. **Seguranca** - security-auditor valida TODAS as regras
2. **Testes** - tester garante cobertura adequada
3. **Documentacao** - documenter cria docs obrigatorias
4. **UI/UX** - ui-ux-reviewer pesquisa competidores
5. **Qualidade** - quality-checker roda verificacoes
6. **Conformidade** - final-validator valida TUDO antes do commit

---

## Atualizacao

Ao adicionar novas regras ao projeto:

1. Atualizar `/claude.md` com a regra
2. Atualizar agente relevante em `.claude/agents/`
3. Atualizar `final-validator.md` com novo item no checklist
4. Se necessario, adicionar pattern em `hooks/security-check.js`
