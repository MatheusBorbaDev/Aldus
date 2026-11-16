# Community, Flashcards/Battle e comunidade futura

> Módulo de referência. Ler somente quando Community, Estudo ou Battle estiver no escopo.
> Texto preservado do PROJECT_CONTEXT.md original (2192 linhas, escrito pelo Codex), movido sem reescrita em 06/11/2026. Trate como hipótese: confira Git/código antes de confiar. O estado atual e as pendências estão em [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md).

## 11. Community

Community v0.1 preservada em src/community/ e app/community/, entrada em Ajustes.
Modelos: LiteraryProfile, ReadingStats, ReadingActivity, LiteraryLevel, Achievement,
Progression e contratos Follow, BookClub, DiscussionThread, CommunityPost/Comment/spoilers.
Home/perfil/editor/meta/timeline/prévia de privacidade e foundations de clubes/fóruns/pessoas
existem. Empty states não representam rede social publicada; não iniciar Etapa 2 implicitamente.

LocalCommunityRepository: chave @aldus/community.v1:<userId codificado>, revisão,
serialização v1, filas por storage/conta, corrupção/falha preservando dados. Web exige
Web Locks para escrita entre abas; Native usa AsyncStorage/fila. Provider esconde resultado
de outra identidade e usa Auth apenas na borda; domínio/application não dependem de Supabase.

LegacyReadingDataSource é somente leitura e continua declarando scope=device/userId=null,
com inclusão opt-in por conta e desligada por padrão. Repository da Library ser account-scoped
não autoriza inventar histórico medido. Ausente é null, não zero; última página não é páginas
lidas e última abertura não é sessão. Interrompido não significa abandonado. Sem data real,
occurredAt=null. Não inferir gêneros/tempo/streak/conclusões anuais.

Progressão interna: início 10, conclusão 100, dia medido 5; chaves semânticas impedem pontos
duplicados em refresh/toggle. Releitura exige identidade confiável do evento, não UUID da UI.
Perfil privado por padrão. FOLLOWERS falha fechado sem relação verificada. PUBLIC é prévia local,
não publicação real. XP local não é pontuação autoritativa para enviar ao servidor.

Migration 202610130001_community_foundation.sql prepara profiles/stats/activities/awards/
achievements com auth.users, owner e privacidade. Derivados não aceitam escrita cliente;
atividade pública exige perfil público. Testada em PostgreSQL/PGlite local, não aplicada
remotamente. Não existe SupabaseCommunityRepository nesta entrega. Social graph depende
de servidor/eventos confiáveis, sync/conflitos e testes A/B/anon antes de habilitar publicação.

## 12. Flashcards

Termos da UI: deck/decks e flashcard/flashcards. Editor completo: deck, título centralizado,
afirmação multilinha, true/false explícito, explicação no verso e imagem/desenho opcionais;
frente sem gabarito, verso após resposta, sem área vazia quando não há visual.
Criação/edição preserva rascunho em falha, previne toque duplicado e confirma saída alterada.
PNG/JPEG/WebP até 3 MB; desenho local com traço/apagar/desfazer/limpar e limite 2.500 pontos.
Título até 240, afirmação 20.000, explicação 30.000 caracteres; não definir gabarito silencioso.

| Resposta | Julgamento | Confiança | Acerto / erro |
| --- | --- | --- | --- |
| XX | Falso | Alta | +10 / -10 |
| X | Falso | Baixa | +5 / -5 |
| ✓ | Verdadeiro | Baixa | +5 / -5 |
| ✓✓ | Verdadeiro | Alta | +10 / -10 |

Zero inicial, negativos permitidos, verde=acerto e vermelho=erro, inclusive gabarito falso.
Mesma regra versionada no Study e Battle; sem bônus/cronômetro. Resposta/avanço e conteúdo
congelado são duráveis/idempotentes antes de revelar. Resumo mostra pontos/acertos/erros/
explicações; retomar não reinicia a sessão. SRS SM-2 existente é preservado, separado do placar.

Persistência por conta @kindle/flashcards.v1:<UUID>, SQLite kv-store kindle-flashcards.db
no Native e IndexedDB kindle-flashcards/snapshots na Web. Migração copia legado da mesma
conta sem apagá-lo/sobrescrever o novo. Quota falha explicitamente; oncomplete confirma Web.
Cartões incompletos exigem revisão antes de uso. Geração local por capítulos/grifos cria
rascunhos editáveis com origem, sem IA remota/gabarito inventado. Origem exata pelo Reader,
Anki e sync de cartões/revisões ainda são evoluções, não parte do engine da Library.

Batalha: cliente Supabase e RPC public.flashcard_battle(action,payload), auth.uid,
schema flashcard_private, snapshots/filas/gabaritos privados e pontuação no servidor.
N=3/5/10/15; dois usuários distintos escolhem decks suficientes e confirmam.
A fornece N para B e B fornece N para A, sorteio sem repetição e sem mudar propriedade.
Cada um avança independentemente; primeiro a terminar espera; maior pontuação vence, empate
por igualdade. Sem derrota por desconexão, expiração ou abandono presumido.
Retomada consulta partida; polling de 3s só na tela ativa/foreground. Deck de batalha até
500 cartões/16 MB; gabarito/explicação não são enviados antes da resposta aceita.

Cliente Battle congela UUID/epoch/JWT para toda operação upload→join, usa HTTP autenticado
com cancelamento ao trocar conta e rejeita resposta A→B→A. UI remonta somente o conteúdo
da batalha ao mudar UUID e ignora load/resultado após blur. Não altera estudo/SRS local.
Testes test-battle-account.cjs e PostgreSQL real test-flashcard-battles.cjs não equivalem
a duas sessões Supabase autenticadas independentes.

Migration 202610090001_flashcard_battles.sql e supabase/tests/flashcard_battles_manual.sql
passaram historicamente em PostgreSQL isolado; usuário informou deploy real como versão
20261015144958=flashcard_battles. Não reaplicar. Duas sessões reais continuam pendentes.
Verificar Auth/ledger antes de aplicar. O projeto doador C:/Flashcards não é o backend do Aldus:
JWT distinto, gateway com isCorrect do cliente e regras de HP/velocidade não são reutilizados.
Nenhuma geração por IA/cobrança/serviço doador deve ser anunciada como concluída.

## 13. Comunidade futura

Sequência real: Social Graph/perfis públicos → feed → clubes/leitura conjunta → fóruns/
teorias/spoilers → desafios/achievements ampliados → moderação/denúncias/bloqueios.
Relações/verificações, acesso a clubes, autoria e eventos/XP devem ser autoritativos no servidor.
Sem criar followers/clubes/posts falsos, ativar FOLLOWERS ou enviar livros privados por padrão.

### 13.1 Plano de mercado — FASE 5a: leitura conjunta (planejamento, 11/11/2026; nada implementado)

Ideia: pessoas lendo o mesmo título no mesmo ritmo, com comentários que só aparecem para quem já passou daquele ponto. Cada pessoa
usa a **própria cópia**; o Aldus nunca envia, empresta ou hospeda o arquivo do livro para outra pessoa, e cópias com DRM de loja
podem não abrir no app (aviso obrigatório na entrada do clube). Sem ranking, sem "quem leu mais", sem comparação de ritmo.

- **Âncora entre edições:** posições do Reader (âncora EPUB, página do PDF, Leitura Livre) dependem do arquivo de cada um e não valem
  entre edições. Comentário e spoiler ancoram em **marcos do clube** (capítulo ou trecho combinado, p.ex. "até o fim do cap. 7"), e
  cada pessoa marca "cheguei ao marco" (ou o app sugere pelo título do capítulo do próprio arquivo, sem afirmar quando não reconhecer).
- **Ordem (a mesma do §13):** (1) grafo social e perfis públicos (**G**: `SupabaseCommunityRepository`, migration
  `202610130001` aplicada com autorização, RLS, testes A/B/anônimo); (2) clubes e participação (**G**: convite por link, dono,
  saída, exclusão, limite de membros; tudo autoritativo no servidor); (3) comentários ancorados em marco (**M/G**: visíveis só para
  membros que marcaram o marco; edição/exclusão pelo autor; nada de feed global); (4) moderação (**G**, pré-requisito para abrir a
  clubes públicos: denunciar, bloquear, remover, fila do dono, termos de conduta e canal legal). Clubes só por convite até (4) existir.
- **Dados e privacidade:** progresso compartilhado é só "marco N alcançado" com data, opt-in por clube; nunca porcentagem, tempo de
  leitura ou sessões medidas (FASE 2 continua só no aparelho). Sair do clube apaga as marcações dele no servidor.
- **Riscos:** spoiler por marco mal definido; conteúdo ilegal em comentário (moderação antes de abrir); pressão social (nada de
  lembretes de "você está atrasado"). Dependências remotas exigem autorização específica (schema/Auth/RLS).

A FASE 5b é a parte **local** disso, sem servidor: marcos de um livro, cartão-cronograma e "marco 2 de 3" (ver log do PROJECT_CONTEXT).

### 13.2 Etapa 2 — grafo social (12/11/2026; código pronto; servidor aplicado em 12/11, sem homologação autenticada)

- **Servidor** (`supabase/migrations/20261112120000_community_social_graph.sql`, depende de `202610060001` e `202610130001`): identidade do
  perfil publicado copiada da conta por trigger; `community_follows` (pending/accepted), `community_blocks`, `community_reports`; função
  `community_can_view(owner, privacy)` usada nas políticas de perfil e atividade; RPCs `community_find_reader`, `community_search_readers`,
  `community_follow`/`unfollow`, `community_respond_follow`, `community_remove_follower`, `community_list_follows`, `community_block`/
  `unblock`, `community_list_blocked`, `community_report`. Erros `community:<motivo>`. Nenhum grant de escrita nas três tabelas novas.
- **App**: `domain/social.ts` (tipos, validação do contrato, textos), `data/SupabaseCommunityGateway.ts`, telas `CommunityPeopleScreen` e
  `CommunityReaderScreen` (rotas `/community/people` e `/community/reader/[username]`). Publicar é ato explícito na tela Pessoas; salvar o
  perfil não publica. Só sai do aparelho: nome de exibição, @usuário, avatar, bio, favoritos, meta anual e privacidade.
- **Decisões**: sem contagem de seguidores, ranking ou comparação; busca só entre perfis públicos e em ordem alfabética; quem segue aparece
  para o seguido pelo @usuário da conta; bloqueio não avisa a pessoa; denúncia não é legível pelo cliente (tratamento manual via service role
  até existir painel no Admin). Atividades, estatísticas e XP continuam sem publicação (não há fonte confiável no servidor).
- **Servidor**: as duas migrations foram aplicadas em 12/11/2026 pelo editor SQL do painel (autorização do dono; evidência no log do
  PROJECT_CONTEXT). Não constam no ledger `supabase_migrations.schema_migrations`: quem usar CLI/conector depois deve tratá-las como já
  existentes, sem `db push`. Falta: conferir com duas contas reais (publicar, pedir para seguir, aceitar, bloquear, denunciar), publicar o
  app com o código novo e aprovar o texto de privacidade sobre o perfil publicado.
- **Próximo** (§13.1): clubes por convite e comentários ancorados em marco; moderação (fila de denúncias, termos de conduta) antes de clube público.

### 13.3 Etapa 3 — clubes e fóruns (16/11/2026; código pronto; servidor aplicado em 16/11, sem homologação autenticada)

- **Servidor** (`supabase/migrations/20261116120000_community_clubs_forums.sql`, depende das migrations de 13/10 e 12/11): tabelas
  `community_clubs`, `community_club_members`, `community_club_comments`, `community_threads`, `community_posts`,
  `community_content_reports`, com RLS ligado e **nenhum grant**: tudo por RPC `security definer` que responde só sobre quem chama
  (`community_create_club`, `join_club`, `leave_club`, `delete_club`, `list_my_clubs`, `club_detail`, `set_club_milestone`,
  `add_club_comment`, `list_club_comments`, `remove_club_comment`, `remove_club_member`, `regenerate_invite`, `create_thread`,
  `list_threads`, `thread_detail`, `add_post`, `remove_thread`, `remove_post`, `report_content`). Erros `community:<motivo>`
  (`text`, `milestone`, `owner`, `report`, `limit`, `target`, `query`). Limites contra abuso: 20 clubes por dono, 50 membros por clube, 30 comentários e 60 respostas por hora, 10 tópicos e 20 denúncias por dia.
- **Regras**: clube só por código de convite (gerar outro invalida o antigo); 2 a 12 marcos definidos por quem cria; cada membro marca até
  onde leu (só "marco N", nunca porcentagem ou tempo); comentário só sobre marco já alcançado e visível só a quem chegou nele; sair apaga a
  marcação e a participação (o dono não sai: exclui o clube); o dono remove membros e comentários e pode excluir o clube. Fóruns: tópicos e respostas de quem está na conta, com
  marcação de spoiler escondida até o toque; o autor remove o que escreveu. Sem contagens de
  membros, respostas ou curtidas; sem feed global; nenhum arquivo de livro passa pelo servidor (aviso de DRM no clube e no convite).
- **App**: `src/community/domain/clubs.ts` (tipos, validação do contrato, marcos, código de convite), `SupabaseCommunityGateway`
  (implementa `CommunityClubsGateway`), telas `CommunityClubsScreen`, `CommunityClubScreen`, `CommunityForumsScreen`,
  `CommunityThreadScreen` e `ContentReport` (rotas `/community/clubs`, `/community/club/[id]`, `/community/forums`, `/community/thread/[id]`).
- **Moderação**: denúncia de comentário, tópico ou resposta grava em `community_content_reports` (não legível pelo cliente); tratamento
  manual via service role até existir fila no Admin. Clube público continua fora até haver fila, termos de conduta e canal legal.
- **Servidor**: aplicada em 16/11/2026 pelo editor SQL do painel, conferida por SHA-256, catálogo e sonda REST anônima (evidência no log do
  PROJECT_CONTEXT). Fora do ledger `supabase_migrations.schema_migrations`, como as de 12/11: tratar como já existente, sem `db push`.
  Falta conferir com duas contas reais (criar clube, entrar pelo código, marcar marco, comentar, tópico com spoiler, denúncia).
  Testes: `test-community-clubs-schema` (PGlite, contas A/B/C/anon) e `test-community-clubs` (telas simuladas).
