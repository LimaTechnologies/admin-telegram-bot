# /fix - Corrigir Bug

---

command: fix
description: Inicia o fluxo para correcao de bug
usage: /fix [descricao do bug]

---

## Instrucoes

Ao receber este comando, execute o fluxo de correcao:

### 1. Analisar o Bug

```
orchestrator
  └── analyzer
      ├── Identificar arquivos afetados
      ├── Identificar causa raiz
      └── Avaliar impacto da correcao
```

### 2. Fluxo Simplificado

Para bug fixes, o fluxo e reduzido:

```
orchestrator
  ├── analyzer (identificar causa e impacto)
  ├── [IMPLEMENTAR FIX]
  ├── tester (criar/atualizar testes para cobrir o bug)
  ├── security-auditor (validar que fix nao introduz vulnerabilidade)
  ├── quality-checker (typecheck, lint, build)
  └── final-validator (checklist adaptado)
```

### 3. Testes Obrigatorios

Para TODO bug fix:

- [ ] Criar teste que reproduz o bug (antes do fix, deve falhar)
- [ ] Implementar o fix
- [ ] Verificar que teste agora passa
- [ ] Verificar que outros testes nao quebraram

### 4. Criterios de Sucesso

- [ ] Causa raiz identificada
- [ ] Fix implementado
- [ ] Teste de regressao criado
- [ ] Testes passando
- [ ] Seguranca validada
- [ ] Build passando
- [ ] Checklist aprovado

### 5. Output Esperado

```markdown
## Bug Fix: [Descricao]

### Causa Raiz

[Explicacao]

### Arquivos Modificados

- [arquivo]: [mudanca]

### Teste de Regressao

[arquivo de teste criado]

### Commit

fix: [descricao curta]

[descricao detalhada do bug e fix]
```
