# /validate - Executar Validacao Completa

---

command: validate
description: Executa validacao completa do estado atual
usage: /validate

---

## Instrucoes

Ao receber este comando, execute validacao completa:

### 1. Verificacoes de Qualidade

```bash
# Executar em sequencia
bun run typecheck
bun run lint
bun run test
bun run test:e2e
bun run build
```

### 2. Auditoria de Seguranca

Ativar `security-auditor` para:

- [ ] Verificar todos os arquivos modificados recentemente
- [ ] Buscar padroes perigosos
- [ ] Validar regras de seguranca do projeto

### 3. Validacao Final

Ativar `final-validator` para:

- [ ] Executar checklist completo
- [ ] Verificar todas as regras do claude.md
- [ ] Gerar relatorio de conformidade

### 4. Output Esperado

```markdown
## Validacao Completa

### Qualidade

| Check     | Status  | Detalhes       |
| --------- | ------- | -------------- |
| typecheck | OK/FAIL | [N erros]      |
| lint      | OK/FAIL | [N erros]      |
| test      | OK/FAIL | [N/M passaram] |
| test:e2e  | OK/FAIL | [N/M passaram] |
| build     | OK/FAIL | [tempo]        |

### Seguranca

[Relatorio do security-auditor]

### Conformidade

[Relatorio do final-validator]

### Status Geral

**[APROVADO / ISSUES ENCONTRADAS]**

### Acoes Necessarias (se houver)

1. [Acao]
```
