# /research - Pesquisar Best Practices

---

command: research
description: Pesquisa best practices e documenta
usage: /research [topico]

---

## Instrucoes

Ao receber este comando, execute pesquisa completa:

### 1. Pesquisar no Google

Buscar por:

- "[topico] best practices 2025"
- "[topico] industry standards"
- "[topico] [nossa stack - React/Next.js/tRPC/Mongoose]"

### 2. Fontes Prioritarias

1. Documentacao oficial (Next.js, React, MongoDB, etc)
2. Blogs de engenharia de empresas (Vercel, Meta, Google)
3. OWASP (para seguranca)
4. Articles revisados (Medium, Dev.to com muitos claps)
5. GitHub discussions/issues

### 3. Estrutura do Documento

Criar em `docs/research/[topico].md`:

```markdown
# Pesquisa: [Topico]

**Data:** [YYYY-MM-DD]
**Fontes:** [Lista]

---

## Por Que Pesquisamos

[Contexto]

## Descobertas Principais

### [Aspecto 1]

[Detalhes]

### [Aspecto 2]

[Detalhes]

## Regras Derivadas

1. [Regra aplicavel ao projeto]
2. [Regra aplicavel ao projeto]

## Checklist de Implementacao

- [ ] [Item]
- [ ] [Item]

## Referencias

- [Link 1](url)
- [Link 2](url)
```

### 4. Atualizar Documentacao

- [ ] Adicionar link em `docs/README.md`
- [ ] Adicionar regras resumidas em `claude.md`
- [ ] Atualizar agentes relevantes se necessario

### 5. Output Esperado

```markdown
## Pesquisa Concluida: [Topico]

### Arquivo Criado

docs/research/[topico].md

### Principais Descobertas

1. [Descoberta]
2. [Descoberta]

### Regras Adicionadas ao Projeto

1. [Regra]
2. [Regra]

### Arquivos Atualizados

- docs/README.md
- claude.md

### Fontes Consultadas

- [URL 1]
- [URL 2]
```
