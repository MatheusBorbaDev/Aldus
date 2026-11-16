# Log — Instruções para outras IAs: fluxo de engenharia, design e implantação (12/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 12/11/2026 — Instruções para outras IAs: fluxo de engenharia, design e implantação (Claude)
- Pedido do usuário: deixar instruções de como seguir com o projeto, melhorias de design, estrutura dos desenvolvimentos e implantações.
- Nova skill `aldus-engineering-workflow` (inventário, decisões do dono × técnicas, fatias em commits verdes, camadas e convenções, testes,
  gates, ordem de implantação, relato) com `references/pitfalls.md` (armadilhas reais de shell/CRLF, simulados de teste, navegador, build
  Android, dados e textos). `aldus-interface-review` ganhou o roteiro de melhoria de design (ver a tela, propor, medir em 320/390 e texto
  ampliado, evidência). `verify-android-apk-delivery`: limpar `generated/res/react/release` após remover assets, conferir livros por hash,
  UTF-16 no Hermes, limites de entrega ao celular. `aldus-backend-operations`: caminho sem CLI (sonda REST anônima, painel SQL com conferência
  por SHA-256, ledger). `aldus-web-delivery`: guarda do acervo no pós-export. AGENTS com resumo e catálogo; README com doze skills.
- VALIDADO: `node scripts/validate-ai-instructions.cjs` PASS (12 skills, 17 documentos) e `git diff --check`. Só documentação: suítes do app não
  foram reexecutadas. As regras de produto do dono (11/11) ficaram registradas na skill nova, §3.
