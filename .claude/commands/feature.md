# /feature - Iniciar Nova Feature

---

command: feature
description: Inicia o fluxo completo para uma nova feature
usage: /feature [descricao da feature]

---

## Fluxo de Desenvolvimento

Execute na ordem (use Task tool para invocar cada agente):

| Ordem | Agente            | Arquivo                              | Quando    |
| ----- | ----------------- | ------------------------------------ | --------- |
| 1     | analyzer          | `.claude/agents/analyzer.md`         | Sempre    |
| 2     | ui-ux-reviewer    | `.claude/agents/ui-ux-reviewer.md`   | Se tem UI |
| 3     | documenter        | `.claude/agents/documenter.md`       | Sempre    |
| 4     | **[IMPLEMENTAR]** | -                                    | -         |
| 5     | tester            | `.claude/agents/tester.md`           | Sempre    |
| 6     | security-auditor  | `.claude/agents/security-auditor.md` | Sempre    |
| 7     | quality-checker   | `.claude/agents/quality-checker.md`  | Sempre    |
| 8     | final-validator   | `.claude/agents/final-validator.md`  | Sempre    |
| 9     | commit-manager    | `.claude/agents/commit-manager.md`   | Sempre    |

---

## Quality Gates

```bash
bun run typecheck && bun run lint && bun run test && bun run test:e2e && bun run build
```

---

## Critérios de Sucesso

- [ ] Analyzer executado antes da implementação
- [ ] Agentes executados na ordem
- [ ] Testes criados (unit + E2E se UI)
- [ ] Todos quality gates passaram
- [ ] Documentação atualizada
- [ ] Security audit aprovado
- [ ] Commit convencional criado

- [ ] Quality gates passando
- [ ] Final validation aprovada
