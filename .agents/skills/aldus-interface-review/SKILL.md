---
name: aldus-interface-review
description: "Evoluir e revisar a interface Aldus em pt-BR, temas, responsividade e acessibilidade, preservando a geometria do Reader e a arquitetura existente."
---

# Interface literária e consistente

Leia o [contexto](../../../PROJECT_CONTEXT.md) (estado da reformulação UX/UI e árvore suja), o módulo
[design-system](../../../docs/context/design-system.md) (decisões, fases e regras de `src/ui`), a tela real
e o tema em uso. Identifique alterações locais ainda não concluídas antes de reutilizar
componentes. A existência de um arquivo não comprova que ele está integrado ou validado.

- Use a paleta/tokens/componentes existentes. Não introduza fonte nativa, NativeWind novo,
  biblioteca de UI ou refatoração ampla para reproduzir uma referência visual.
- DesignIdeas é inspiração local: observe conceitos e implemente na arquitetura oficial.
  Não faça merge/cherry-pick em massa do bundle nem exija seus arquivos para compilar.
- Preserve visual sóbrio, editorial e legível. pt-BR deve ter acentuação, ação concreta e
  termos que o usuário entende. Detalhes técnicos/JSON ficam em ferramentas avançadas.
- Auth, perfil ativo, permissões e dados reais continuam decididos pelos contratos existentes.
  Interface não fabrica plano/métrica/atividade para preencher espaços vazios.
- Controles de toque têm área mínima existente de 44px, rótulos e estado acessíveis.
  Confira teclado/Enter/foco na Web, leitor de tela quando disponível e contraste nos temas.
- Teste reflow da UI em larguras 320/390/768/1440, claro/escuro e texto aumentado quando
  a mudança afetar layout. Conteúdo/ações de saída não podem ficar inacessíveis ou sobrepostos.
- Tabs Web e telas gerais podem responder à largura; o Reader preserva viewport/ancestralidade
  e geometria próprias. Não amplie sua área junto de um redesenho do shell sem escopo específico.
- Estado de gravação, erro e retry devem preservar rascunho/seleção quando apropriado.
  Excluir mantém confirmação; saída e ações principais permanecem alcançáveis.

Ao editar vários TSX, revise hooks/cleanup, dependências de efeitos, closures obsoletas,
cancelamento/epoch, keys estáveis, estados vazios/erro/loading e ausência de efeitos de
persistência disparados só por render. Se a skill React oficial estiver disponível,
aplique sua revisão pertinente sem torná-la dependência de outra máquina.

Escolha testes de componente e browser pela tela usando
[aldus-validation](../aldus-validation/SKILL.md). Inspecione as capturas geradas. Registre
se o resultado é componente controlado, aplicativo exportado ou preview autenticado.
Escala CSS e clique DOM não comprovam fonte do sistema, TalkBack ou toque Android.

## Melhoria de design: como conduzir

1. **Veja a tela antes de opinar.** Abra a tela real ou o fixture dela, capture e leia a captura. Descreva o
   problema nas palavras de quem usa ("o rótulo corta", "não sei o que este botão faz"), não em termos de código.
2. **Mudança de estrutura pede proposta curta primeiro** (o que sai, o que entra, o que muda de lugar) e
   aprovação do dono. Correção pontual de legibilidade, rótulo ou espaçamento pode ser feita direto e relatada.
3. **Um controle por decisão.** Painel do Reader fica baixo para o texto continuar visível atrás; o que é raro
   vai para uma seção, não para a primeira dobra. Navegar entre seções não recria controles nem grava preferência.
4. **Texto que não cabe não se resolve diminuindo a fonte.** Rótulo longo vira linha inteira (lista), não coluna
   estreita. Seleção se mostra por contorno e peso, não só por cor.
5. **Todo texto diz a consequência.** Botão diz o que acontece ("Retirar meu perfil da rede"), aviso diz o que
   sai do aparelho e o que não sai, ação destrutiva tem um segundo passo "Confirmar: …". Lista vazia é dita
   como vazia; nunca se preenche espaço com número, pessoa ou atividade inventada.
6. **Número novo nasce ocultável** e segue "Ocultar porcentagem e páginas". Sem contagem de seguidores,
   ranking ou comparação entre pessoas.
7. **Meça, não estime.** No navegador controlado, em 320 e 390 px e com texto em 1,3× e 1,6×, confira para
   cada rótulo novo que `scrollHeight` não passa de `clientHeight`, que o texto fica dentro do botão e que a
   página não ganha rolagem horizontal. O painel de ajustes tem fixture própria
   (`node scripts/build-reader-settings-web-fixture.cjs`) e a matriz `npm run test:reader:settings:web`.
8. **Entregue com evidência**: captura depois da mudança lida por você, medidas, suítes da tela e a lista do
   que só o aparelho pode confirmar (fonte do sistema, toque, TalkBack). Diga o que é só Android.
