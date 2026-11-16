# Log — Community, Etapa 2: grafo social (12/11/2026)

Entrada movida sem edição do §10 do PROJECT_CONTEXT em 16/11/2026.

### 12/11/2026 — Community, Etapa 2: grafo social (Claude)
- Pedido: "desenvolva e aprimore a parte de rede social". Segui a ordem do §13: primeiro perfis publicados e seguir. `0ffe781` migration
  `20261112120000_community_social_graph.sql` (só local): identidade do perfil publicado vem da conta (`public.profiles`; a foundation deixava o
  cliente escolher o `username`), `community_follows` pending/accepted (PUBLIC direto, FOLLOWERS por pedido, PRIVATE nunca), política FOLLOWERS
  aberta só a aceitos, `community_blocks` nos dois sentidos, `community_reports` sem leitura pelo cliente (20/dia), escrita só por RPC que responde
  sobre quem chama, busca por prefixo só entre públicos e sem contagens. `2140f8f` app: tela Pessoas (publicar por ato explícito com aviso do
  que sai do aparelho, atualizar/retirar com confirmação, buscar, pedidos, seguindo/seguidores/bloqueados), perfil de leitor (seguir/pedir/cancelar,
  bloquear, denunciar), `SupabaseCommunityGateway` (sessão da conta em cada chamada, contrato validado, erros mapeados, "indisponível no servidor").
- Não feito: aplicar no Supabase (exige autorização), atividades/estatísticas publicadas (continuam derivadas só pelo servidor, sem fonte confiável),
  clubes, comentários, painel de denúncias no Admin, texto de privacidade. Sem contagem de seguidores, ranking ou comparação.
- NÃO TESTADO (até a aplicação abaixo): Supabase real, navegador e Android das telas novas.
- **Aplicação remota (12/11, autorizada pelo usuário: "Sim, aplicar" e "Usar o Chrome")**: projeto "Kindle reader" (branch main/PRODUCTION), editor SQL
  do painel no Chrome do usuário. Inventário somente leitura antes: PG 17.6, 7 contas todas com @usuário, nenhuma tabela/função `community*`, ledger com
  7 migrations (versões remotas diferentes das locais). Cada arquivo foi colado e conferido por SHA-256 contra o repositório antes de rodar
  (`cc0e8c36…4c6ded` foundation, `4e2780a1…6f1a91` social graph); ambos "Success". O painel avisou de operação destrutiva na segunda (troca de duas
  políticas em tabelas recém-criadas e vazias; `delete` só dentro de funções); confirmado. Depois: 8 tabelas com RLS, 10 políticas, 18 funções com os
  grants esperados (RPCs só `authenticated`; internas sem execução por cliente; `community_can_view` para anon/authenticated), só SELECT em follows/blocks
  e nada em reports para clientes, gatilhos novos em `profiles`/`community_profiles`, 0 linhas. Sonda REST anônima: perfis/atividades 200 `[]`,
  follows/blocks/reports e RPCs 401, escrita direta 401. Nenhum dado existente alterado. **Não feito**: registro no ledger, homologação com sessões
  reais A/B (não há contas de teste autorizadas), deploy do frontend.
