---
name: aldus-engineering-workflow
description: "Conduzir um desenvolvimento no Aldus do pedido à entrega: inventário, decisões do dono, fatiamento em commits, camadas, testes, gates e ordem de implantação. Use ao iniciar qualquer recurso, melhoria ou plano de várias fases."
---

# Fluxo de engenharia do Aldus

Esta skill diz **como trabalhar**; o que existe e o que falta está em
[PROJECT_CONTEXT.md](../../../PROJECT_CONTEXT.md). Comece por
[aldus-project-continuity](../aldus-project-continuity/SKILL.md) e carregue a skill da área.
As armadilhas de ambiente e de testes já encontradas estão em [pitfalls](references/pitfalls.md).

## 1. Antes de escrever código

- Faça um inventário **somente leitura** do que o pedido toca: o que já existe, o que falta,
  onde mexer e o que pode quebrar. Entregue isso em poucas linhas antes de planos longos.
- Confira no código toda afirmação que for parar em tela, termo legal ou landing. Exemplo real:
  "não distribui livros" era falso enquanto o acervo embutido ia no APK; o texto saiu sem a frase.
- Separe o que é **decisão do dono** do que é decisão técnica. É do dono: ação irreversível ou
  remota, texto legal/público, dado que sai do aparelho, dependência nova, regra de produto e
  qualquer coisa com duas leituras razoáveis do pedido. O resto você decide e relata.
- Pergunte uma vez, com opções fechadas e a recomendada primeiro. Não pergunte o que tem padrão
  óbvio. Se o dono mandou seguir todas as fases, siga sem parar entre elas e relate no fim;
  caso contrário pare ao fim de cada fase.
- Planejamento não é implementação: plano com tamanho P/M/G vai para o módulo da área em
  `docs/context/`, sem código.

## 2. Fatiar o trabalho

- Um commit por item, e **cada commit compila e passa nos gates sozinho**. Documentação em commit
  próprio. Itens que só fazem sentido juntos viram dois commits consistentes (base, depois uso),
  nunca cinco quebrados; explique a divisão no corpo do commit.
- Ordem dentro de um item: domínio → dados → composição → hook → tela → teste → registro.
- Trabalho pronto em branch antigo entra por `git cherry-pick -x`, com os conflitos resolvidos a
  favor das decisões mais novas da `main`, e os testes do branch adaptados a elas.

## 3. Camadas e convenções

- **Domínio** (`src/domain/<área>/`, `src/community/domain/`): funções puras, sem React nem
  armazenamento; relógio e identificadores injetados; valida tudo o que lê de fora.
- **Dados** (`src/data/...`): um armazenamento por conta, chave `@aldus/<recurso>.v1:<conta>`.
  Dado do usuário ilegível é preservado (a gravação falha em vez de sobrescrever); cache derivado
  pode valer como vazio. Gravações em fila, com limite de tamanho. Chaves legadas `@kindle/*` e
  `fileHash` (do Sync) não são reaproveitados para outro fim.
- **Composição**: só em `src/presentation/services/dependencies.ts` (ou no `runtime` da Community).
- **Hook**: captura a conta no início, não grava se ela mudou, limpa o que abriu e nunca toca
  posição, documento ou progresso do Reader para medir ou exibir algo.
- **Tela**: componentes e tokens existentes; no `ReaderScreen`, modal novo só é montado quando
  aberto; ação destrutiva pede confirmação em dois passos; estado vazio é dito como vazio.
- **Remoto**: tipos e validação do contrato no domínio; o gateway confere a sessão da conta a cada
  chamada e trata "ainda não disponível no servidor"; escrita sensível só por RPC; mudança de
  schema é migration incremental nova, testada em PGlite com as migrations reais.
- **Regras de produto do dono** (11/11/2026, valem até ele mudar): números só medidos e sempre
  ocultáveis (seguem "Ocultar porcentagem e páginas"); sem streak punitivo, ranking, comparação
  entre pessoas ou contagem de seguidores; dizer o que é só Android e não presumir iOS; nada que
  envie arquivos de livros a outra pessoa; sem cobrança ou gateway; texto legal ou público é
  mostrado antes de aplicar; fontes de pirataria não são integradas nem pré-configuradas.

## 4. Testes

- **Lista de entrega**: todo recurso pedido pelo dono entra em `scripts/verify-release-features.cjs` no mesmo commit que o
  implementa, com marcadores que só existem quando o recurso está no pacote (texto da tela, rota). Remover um item exige
  pedido do dono. Recurso visível só por um caminho longo conta como ausente para quem usa: deixe o acesso evidente.
- Todo item funcional ganha `scripts/test-NOME.cjs` registrado em `scripts/test-critical.cjs`. O
  teste exercita comportamento: conta A e B, sem conta, dado ilegível, cancelamento, limites,
  servidor indisponível. Procurar uma string no código não é teste de comportamento.
- Prefira o objeto real com as bordas controladas: hook real com relógio, `AppState` e timers
  simulados; tela real com `react-test-renderer`; SQL real em PGlite; gateway com cliente falso.
- Mudou um componente compartilhado ou seus imports? Atualize os simulados que o carregam (lista
  em [pitfalls](references/pitfalls.md)) no mesmo commit.
- Teste antigo quebrou: ache a causa antes de tocar nele. Só ajuste o teste quando o produto
  estiver certo, e diga no commit por que o teste estava frágil.
- Antes de **cada** commit, leia a linha final `N/N critical suites passed`. Um `grep` que saiu com
  código 0 não é aprovação; já houve commit com suíte falhando por causa disso.

## 5. Gates e commit

`npm run typecheck`, `npm run test:critical`, `npm run export:web`, `git diff --check` e as suítes
de navegador da área, escolhidas em [aldus-validation](../aldus-validation/SKILL.md). Para
instruções e skills: `node scripts/validate-ai-instructions.cjs`.

Mensagem de commit em inglês, no padrão `tipo(área): resumo`, com corpo dizendo o porquê, as
decisões do dono envolvidas e os limites; linha de coautoria conforme a sessão. Stage por caminho.
Sem push, instalação ou deploy fora do pedido vigente.

## 6. Implantação: ordem e portões

Cada passo precisa da sua própria autorização; uma autorização cumprida não vale para a próxima.

1. **Código**: gates verdes na revisão que vai ser entregue, árvore limpa.
2. **Servidor**, se houver migration: [aldus-backend-operations](../aldus-backend-operations/SKILL.md).
   Inventário somente leitura, aplicar só o incremento autorizado, conferir catálogo e contrato.
3. **APK**: [verify-android-apk-delivery](../verify-android-apk-delivery/SKILL.md). Compilar (o comando já roda a lista de
   entrega e falha se faltar algo), conferir assinatura, arquivar, registrar. Instalar é outro passo.
4. **Web**: [aldus-web-delivery](../aldus-web-delivery/SKILL.md). Export conferido com `npm run verify:release -- --dist`;
   publicar só com pedido.
5. **Homologação**: aparelho e contas reais. Enquanto não acontecer, o item fica `NÃO TESTADO` ali,
   mesmo com tudo verde no PC.
6. **Registro** em PROJECT_CONTEXT (§3, §8 e log), no módulo da área e em BUGS_ATUAIS se couber.

Servidor antes do app quando o app novo depende do schema; o app deve continuar funcionando com o
servidor antigo (mensagem de indisponível), para que a ordem inversa não quebre ninguém.

## 7. Relatar

Responda em pt-BR, com os rótulos `IMPLEMENTADO`, `VALIDADO` (ambiente e cenário), `PARCIAL`,
`PENDENTE`, `NÃO TESTADO`, `INCONCLUSIVO`, `BLOQUEADO`. Diga primeiro o que mudou para quem usa o
app, depois a validação, depois o que falhou no caminho e como foi resolvido, e por fim só as
decisões que dependem do dono. Mudou algo sem perguntar? Diga qual foi e ofereça desfazer.
