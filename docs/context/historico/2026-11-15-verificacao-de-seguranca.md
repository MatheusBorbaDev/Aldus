# Log — Verificação de segurança (15/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 15/11/2026 — Verificação de segurança (Claude)
- Pedido: "faça verificações de segurança no Aldus, corrija o que for necessário". Achados e pendências em BUGS_ATUAIS (SEG 01–04).
- `e71b31d` WebViews nativas presas ao próprio documento, sem acesso a arquivos; pdf.js 3.x com `isEvalSupported:false` (CVE-2024-4367) e
  integridade sha512. `64ad127` `sanitizeBookHtml` (reconstrói as tags; o filtro antigo era contornável) e CSP com nonce no documento do
  Reader; links externos não navegam; caminho RenderHTML filtrado e sem abrir links. `68b18cd` release sem SYSTEM_ALERT_WINDOW; Web com
  `X-Frame-Options: DENY` e `Permissions-Policy`. Novas suítes `book-html-security` e `platform-security`.
- Erro do caminho: o teste de navegador falhou com a CSP nova porque `Page.setDocumentContent` mantém a CSP do primeiro documento na mesma
  página; confirmado por bisseção (só a regra de script causava) e resolvido com nonce fixo no teste. No app cada documento é carga nova.
- Não alterado (decisão do dono): `npm audit` (3 altos só com SDK 58), `debug.keystore` versionado, CSP do app Web.
- 16/11, `127b7db` (dono escolheu "Desligar backup"): backup do Android desligado na nuvem e na transferência entre aparelhos (`allowBackup`
  e `fullBackupContent` false, `data_extraction_rules.xml` excluindo todos os domínios, `tools:replace`; `app.json` espelhado). Manifesto e
  recursos do release conferidos pelo Gradle; `test:critical` 117/117. NÃO TESTADO no aparelho.
