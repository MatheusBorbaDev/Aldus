# Log — Aba Comunidade e lista de entrega obrigatória (16/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 16/11/2026 — Aba Comunidade e lista de entrega obrigatória (Claude)
- Dono: "na última compilação não veio a rede social" e "garanta que o app estará exatamente do jeito que solicitei". Diagnóstico: o APK
  `99ce32d` tinha Pessoas e perfis (confirmado pela checagem nova), mas o acesso era Conta → Comunidade literária → fim da página.
- `c27b26a` (decisão do dono: "Nova aba Comunidade"): barra Biblioteca · Descobrir · Estudo · Comunidade · Conta; Pessoas no topo da
  Comunidade; sem seta de voltar na aba. `2efa908` `scripts/verify-release-features.cjs` com os 21 recursos pedidos e marcadores;
  `--source` na matriz crítica, `--dist` para o site, `--apk` para bundle Hermes, livros e manifesto; `npm run build:apk:local` limpa
  `generated/res/react/release` e falha se a checagem falhar; `npm run verify:release`.
- VALIDADO: typecheck; `test:critical` 118/118; `export:web` e `--dist` PASS; `test:library:web` PASS; `--apk` no `99ce32d` falha só no que veio
  depois (segurança, aba, backup), como esperado. NÃO TESTADO: barra de 5 abas no aparelho e a 320 px ("Comunidade" tem o tamanho de
  "Biblioteca"); próximo APK ainda não compilado (dono: "não por agora").
