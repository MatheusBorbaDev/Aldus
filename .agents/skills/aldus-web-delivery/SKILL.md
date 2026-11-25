---
name: aldus-web-delivery
description: "Exportar, conferir ou publicar o Aldus Web em preview/produção, vinculando dist, build-info, revisão, hashes, rotas e testes ao deployment efetivo."
---

# Entrega Web identificável

Consulte o [README](../../../README.md), `wrangler.jsonc`, `vercel.json` (fonte de cabeçalhos/rotas), scripts de export/metadata e os
[contexto](../../../PROJECT_CONTEXT.md) e o módulo
[legal-build-git](../../../docs/context/legal-build-git.md) (Web/CI) e entregas em `docs/context/historico/`. Não suponha
que a URL de uma entrega antiga aponta para o código atual.

## Preparar e validar localmente

- Confirme HEAD/branch e diferenças, incluindo fontes não versionadas importadas pelo app.
  Se o checkout mudar durante o export, não atribua automaticamente o resultado ao HEAD inicial.
- Use os comandos existentes: gates pertinentes e `npm run export:web`, que executa
  validação de env pública, catálogo, Expo, assets/rotas e metadata. Não exporte ignorando o guard.
- Leia `dist/build-info.json`: commit, dirty e hashes. `dirty=true` descreve uma fonte com
  diferenças; não a apresente como checkout limpo nem apague mudanças para obter `false`.
- O pós-export (`scripts/copy-books-to-dist.mjs`) confere cada arquivo de `assets/Livros` contra o manifesto
  de domínio público e recusa qualquer título do acervo antigo; se falhar, declare o livro com fonte e
  licença ou retire o arquivo, nunca desligue a guarda. `dist` sem livros protegidos fica perto de 16 MB.
- Antes de publicar, `node scripts/verify-release-features.cjs --dist` confere que todos os recursos pedidos estão nos bundles
  de `dist/`; falhou, não publique.
- `node scripts/test-web-build.cjs --exported` confere o export existente. Exercite browser
  conforme [aldus-validation](../aldus-validation/SKILL.md). Não reutilize dist antigo por nome.
- Env pública só pode conter chave anon/publishable e configuração destinada ao cliente.
  Configuração sintética de CI valida build, não login/serviços reais. Produção exige dados
  legais verificados conforme o guard atual.

## Publicação solicitada

1. O site é o Worker Cloudflare `aldus-reader` (só assets, `wrangler.jsonc`), publicado pelo push em `main` (Workers Builds).
   A Vercel foi excluída em 25/11/2026; não recrie projeto lá sem pedido.
2. Publique somente o destino autorizado. Preview de outra branch não autoriza produção.
   Não envie trabalho alheio que esteja no mesmo worktree.
3. Antes do push rode os gates; `export:web` gera `_headers`, `_redirects` e `.assetsignore` para a Cloudflare.
4. Aguarde o build e confira `/build-info.json` em https://aldusreader.com.br: commit, `host: cloudflare`, ambiente. Verifique
   HTTP/rotas/assets e hashes dos bundles contra o artefato local. HTTP 200 não é smoke.
5. Faça os fluxos do pedido na URL publicada. Landing/biblioteca/Reader/Auth/Admin exigem
   evidência própria conforme o escopo. Bundle disponível não comprova Reader pronto ou login.
6. Variáveis de build ficam no painel do Worker; segredos nunca em EXPO_PUBLIC_*.
7. Origin novo pode precisar de allowlist/callback/recovery. Inventarie e registre a lacuna;
   não mude OAuth/Auth geral automaticamente. Não recicle token de recovery de uma captura.

Registre URL HTTPS real, ID/ambiente, fonte/dirty, checks executados e limites no contexto.
Sem publicação realizada, entregue caminhos locais e diga que não houve deploy. Nunca invente
URL, status READY, login autenticado ou aprovação de CI. Um workflow versionado não prova
execução remota; consulte a execução correspondente quando isso fizer parte do pedido.
