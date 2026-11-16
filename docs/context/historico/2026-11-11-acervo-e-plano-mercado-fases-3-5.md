# Log — Acervo (etapas 1–3) e plano de mercado, FASES 3–5 (11/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 11/11/2026 — Acervo (etapas 1–3) e plano de mercado, FASES 3–5 (Claude)
- Pedido: "pode iniciar a implementação de todas as fases" (sem parar entre fases). Acervo: o usuário escolheu **reanexar ao importar** em vez da
  migração automática em duas versões. `51f69f0` cherry-pick da etapa 1 (`11cf66c`): conflitos resolvidos mantendo a decisão da onda 2 (o export
  não copia livros para `dist`; só confere declaração e SHA-256) e as fixtures em domínio público. `44cf826` etapa 2: importar o MESMO arquivo
  (SHA-256 do legado) restaura o livro da conta (mesmo ID, progresso, notas), sem vínculo com o pacote, e o Sync o envia à nuvem privada;
  réplica de outro aparelho deixa de apontar para o arquivo embutido e espera `remotePath`. `809cfac` etapa 3: 33 arquivos fora de
  `assets/Livros` (`dist` 110→16 MB); o export recusa título legado de volta. Nova suíte `legacy-reattach`.
- `53b2ac5` FASE 3 e `1e7583c` FASE 5a: só planejamento (P/M/G). `d5b8767` FASE 4: mockup estático Certo/Errado (CF/88 art. 5º, dados
  fictícios) e roteiro de 10 perguntas (sucesso: 6/10 querem testar, 3/10 pré-pagariam; só intenção, sem cobrança).
- `80d2c88` FASE 5b: "Marcos de leitura" (2/3/4/6, prazo opcional), "marco N de M" no rodapé (oculto com as contagens), cronograma só em
  texto com aviso de DRM; local por conta. Nova suíte `reading-milestones`.
- Limites: sessões (FASE 2) e marcos são só locais; a política de dados ainda não os cita (texto a aprovar). Reanexar exige o mesmo arquivo
  (outra edição vira livro novo). NÃO TESTADO: Android, upload real à nuvem privada, `Share` nativo.
