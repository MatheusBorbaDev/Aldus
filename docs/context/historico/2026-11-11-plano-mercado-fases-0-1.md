# Log de 11/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 11/11/2026 — Plano de mercado, FASE 0 e FASE 1: ganhos rápidos (Claude)
- Plano de 6 fases do usuário (relatórios Ciclo 1/1.1 e pesquisa de 56 respostas). Regras: sem cobrança, sem estatística inventada, sem streak
  punitivo/ranking/comparação, todo número novo ocultável, dizer o que é só Android, nada que facilite compartilhar arquivos de livros, um commit
  por item, **parar após cada fase**. FASE 0 (somente leitura) entregue; o usuário aceitou avançar com a homologação física do Ciclo 1 pendente.
- 1 `f752cf3`: "Disléxica" → "Alta legibilidade (Verdana)", sem promessa sobre dislexia; Verdana ganha `letter-spacing` 0,05em e `word-spacing`
  0,16em no documento EPUB/Reflow (inicial e ao vivo; cópia embutida com paridade em `test-reader-bytecode`). Valor salvo `dyslexic` mantido.
  Fontes viraram linhas inteiras (o rótulo cortava a 320 px e com texto ampliado; medido no fixture Chromium).
- 2 `66f8648`: texto antipirataria aprovado nos Termos (§7) e na landing (pergunta "Posso compartilhar livros pelo Aldus?"). **Sem** "não
  distribui livros": o acervo embutido (`assets/Livros`, 34 arquivos, inclui obras protegidas) ainda vai no APK/Web; os testes travam a frase até
  o acervo ser resolvido. Documentos legais 0.7 → 0.8 (vigência 11/11/2026).
- 3 `9b29311`: aviso de duplicado na importação local. SHA-256 do arquivo escolhido (`hashBookFile`) num índice local por conta
  (`@aldus/import-hashes.v1:<user>`), **sem** tocar `fileHash` (é do Sync) e sem merge/novo UUID. Decisão do usuário: só livros importados a
  partir desta versão (acervo antigo não recalculado). Sem conta, >512 MiB, falha de leitura ou Web sem Blob: importa sem aviso. Nova suíte
  `import-duplicates`. Só a importação por arquivo avisa (catálogos, Drive e "Abrir com Aldus" não). Prompt sem suíte de navegador.
