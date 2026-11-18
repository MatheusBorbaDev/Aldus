# Biblioteca, Library Sync, SaaS e Admin

> Módulo de referência. Seções 5, 6, 6.1 (SaaS freemium) e 6.2 (Aldus Admin).
> Texto preservado do PROJECT_CONTEXT.md original (2192 linhas, escrito pelo Codex), movido sem reescrita em 06/11/2026. Trate como hipótese: confira Git/código antes de confiar. O estado atual e as pendências estão em [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md).

## 5. Biblioteca

Books e organização permanecem separados. Organização por livro: título/autor/capa,
favorito, coleções, tags, série/volume e unread/reading/completed/interrupted; editar estado
não altera posição nem arquivo. Chave/formatos legados são preservados por compatibilidade.
Cards mostram capa, título, autor, formato e status/progresso; menu de reticências de 44px
conserva as duas remoções com confirmação. Organizar mantém as edições existentes.
Não repetir o título inteiro em outro botão nem reservar o espaço do controle removido.

Remover deste dispositivo exige cópia privada remota confirmada/verificada e mantém a conta.
Remover da biblioteca escreve tombstone, inclusive offline; cleanup remoto só após confirmação.
Bundled e transferências têm guardas próprias; nenhum atalho de UI pode contorná-las.

Portabilidade opcional: Ajustes → Privacidade e Dados → Exportar meus dados.
Exporta somente organização, sem EPUB/PDF, progresso, notas ou configurações; não é backup
completo nem requisito de troca de aparelho. Importação JSON opcional mantém políticas
keep-local/use-imported e exige IDs de livros disponíveis na conta atual. A rota legal é
pública, mas a ação exige perfil ativo do mesmo usuário e esconde resposta antiga de outra conta.

## 6. Library Sync

Modelo oficial: entrar, ler/organizar e sincronizar automaticamente; outro dispositivo recebe
dados da mesma conta. Implementação local funciona antes do backend. AccountBookRepository,
AccountOrganizationRepository e LibraryAccountScope validam ownership/epoch em reads e writes.
Logout revoga acesso imediatamente, preserva bytes para relogin e não atribui legado sem dono.
Adoção de livros antigos é explícita; bundled usa identidade verificada e não é enviado.

LibrarySyncService + LibrarySyncCoordinator + replica/journal implementam outbox durável
dirty/ready, operation UUID, baseRevision/shadow, replay de escrita interrompida, CAS,
recibo idempotente e tombstone permanente. Pull inicial aprende exclusões antes do push;
conflito preserva intenção local e pede escolha explícita. Progresso maior/relógio local
não vence automaticamente. Tombstone do pai impede ressuscitar filhos offline.

Importação local completa precede publicação de metadata, upload privado e publicação de
remotePath. Outro dispositivo recebe CLOUD_ONLY, sem baixar EPUB/PDF até abrir.
Download em staging valida tamanho/SHA-256/formato e promove antes de expor ponteiro.
JWT é congelado por operação e respostas antigas são descartadas. Remoção local verifica
remoto; eviction e cleanup são recuperáveis. Falhas nunca apagam outbox para zerar contador.

Sync inclui livros, progresso/âncoras, marcadores/notas, grifos/comentários, organização e
modo/posições PDF separados. Sources/tokens/catálogos, capítulos, capas, OCR/cache, aparência
e Flashcards locais não são enviados por esse engine. Gatilhos: perfil ativo, import/edição,
foreground, retorno de rede e ação manual; sem polling agressivo.

Contrato preparado: public.user_library_items, user_library_operations, sequência de revisões
e RPC library_apply. Bucket aldus-private-library privado; caminho owner/book/SHA256.ext,
EPUB/PDF, teto cliente 512 MiB sujeito ao plano. Sem URL pública/upsert; RLS own SELECT,
escrita via RPC e fences de Storage. Funções SECURITY DEFINER usam search_path vazio e auth.uid.
Migrations 202610110001 e 202610110002 são históricas e não devem ser editadas/reaplicadas por hipótese.

Hardening incremental NOVO 20261015160539_library_active_account_fences.sql, validado
somente em PGlite: move a implementação CAS intacta para library_private (sem acesso cliente),
mantém assinatura pública num wrapper com perfil ativo e adiciona fences restritivas em
SELECT e Storage. Dados/recibos preservados; não aplicado remotamente. Inventariar definições
e schema livre antes do deploy. Grant anon do helper de fence não é vazamento por si só.

Evolução remota em 15/10: a sonda inicial de 10:58 BRT retornava HTTP404/PGRST205.
Na missão integrada, às 12:58 BRT, items/operations passaram a HTTP401/42501 ao anônimo.
O usuário informou aplicação remota 20261015145012=private_account_library e
20261015145018=private_library_file_recovery, equivalentes aos arquivos locais 202610110001/002;
bucket privado e sete policies já existentes. NÃO reaplicar nem reparar ledger por hipótese.
O inventário administrativo e sessões reais A/B continuam pendentes; a sonda pública não os substitui.
Nenhuma migration/DDL ou SQL administrativo remoto foi aplicado pelo agente; outbox preservada.
Sonda anônima real às13:23 BRT negou flashcard_battle/get e library_apply nulo (401/42501),
e library_object_allowed retornou200/false para path sintético. Não enviou conteúdo pessoal
ou operação válida; não é teste autenticado A/B nem aplicação de SQL/migration de produção.
Executar node scripts/audit-private-rpc-anon.cjs para repetir esse contrato público.
Sonda: node scripts/audit-library-sync-public.cjs, somente GET/limit=0 e chave pública.
Procedimento humano: [LIBRARY_SYNC_DEPLOYMENT.md](LIBRARY_SYNC_DEPLOYMENT.md), inventários
supabase/audit/01_inventory.sql e 02_library_sync_inventory.sql para comparar ledger,
definições/ACL/RLS e bucket já implantados. Considerar somente o hardening incremental
20261015160539 após esse inventário; nunca reaplicar 001/002 ou reparar versões por hipótese.

Reconferência pública de 15/10: tabelas às 15:17 BRT e RPCs às 15:28 BRT;
items/operations HTTP401/42501, sem PGRST205;
flashcard_battle/get e library_apply nulo HTTP401/42501, helper de Storage HTTP200/false.
Bucket retornou HTTP400/NoSuchBucket ao anônimo: isso não contradiz o bucket privado
informado nem comprova existência/ausência administrativa. Níveis atuais: IMPLEMENTADO
LOCALMENTE e VALIDADO ANÔNIMO; APLICADO REMOTAMENTE segundo o operador para 001/002.
VALIDADO AUTENTICADO, A/B, CONTA DESATIVADA, STORAGE real e ANDROID continuam pendentes.
O hardening incremental só tem prova local; não houve aplicação remota nesta reconciliação.

Limites: snapshot/outbox JSON por conta e full pull até 100×500 entidades; upload padrão,
sem TUS/resume persistente; parsers/Blob ainda podem usar memória proporcional ao livro.
Evicção verifica arquivo remoto inteiro e consome banda. Não há E2E, compartilhamento público
ou expurgo completo de tombstones/recibos/caches; exclusão de conta ainda é operacional.

Cancelamento/foreground do Sync: engine.cancel limpa running imediatamente sem apagar
outbox. Coordinator usa lifecycle próprio além do epoch de conta: stop invalida preparação
pendente, impede fases de rede posteriores e restart da mesma conta cria execução nova.
Retorno/finally antigo não sobrescreve o estado novo. test-library-cancellation.cjs reproduz
o baseline em --baseline e cobre cancelamento/stop/retomada sem alterar a fila.
O adapter REST propaga cancelamento também ao aguardar sessão SDK, fetch e corpo JSON:
uma Promise externa que não observa AbortSignal não mantém o chamador pendente nem inicia
rede depois do cancelamento. Prazo de I/O encerra a chamada sem tocar na outbox.
Erros distinguem contrato ausente, sessão, autorização/42501 e rede; não recomendar novo
login como solução automática para RLS/ACL negada. test-library-remote cobre essas fronteiras.

### 6.1. SaaS freemium — Etapa 1 (15/10/2026)

IMPLEMENTADO LOCALMENTE / IMPLANTAÇÃO REMOTA PENDENTE. Catálogo autoritativo em
public.saas_plans + saas_plan_features; assinatura em saas_account_subscriptions;
concessões específicas futuras em saas_account_entitlements. Papel master/overrides
anteriores não são assinatura e não promovem para Pro. Nenhum pagamento/provedor/add-on.

| Plano | Preço BRL | Livros sincronizados | Armazenamento privado |
| --- | --- | --- | --- |
| Free | R$ 0 | 100 | 500 MiB (524288000 bytes) |
| Pro | Não definido (`null`) | 2.000 | 10 GiB (10737418240 bytes) |

Valores iniciais configuráveis somente no backend. Todos os planos têm leitor completo,
importação, estudo básico, Sync de biblioteca/progresso/estudo/organização e EPUB/PDF privado.
O baseline não pode ser removido por configuração premium. Recursos novos usam chaves
extensíveis; novos planos usam IDs de catálogo, sem enum Free/Pro no cliente. Futuros
add-ons devem acrescentar concessões/limites no resolvedor do servidor, com nova migration
e versão de contrato quando necessário; não criar compra, saldo ou add-on no cache local.

Migration NOVA: 20261015190705_saas_plans_entitlements.sql, criada pela CLI. Depende de
profiles, Library/recuperação e 20261015160539_library_active_account_fences.sql.
Não editar/reaplicar 202610110001/002 nem reparar ledger remoto por hipótese. Antes de
implantar: inventariar definições/ACL/RLS e a versão real do Storage; reconciliar versões
20261015145012/018 informadas pelo operador; aplicar somente incrementais ausentes na ordem.
Nenhum DDL/migration/Edge Function/deploy remoto foi executado nesta etapa.

Free é atribuído pelo trigger de profiles a novos perfis ativos e na reativação; backfill
aditivo cobre ativos existentes sem tocar em perfis, livros, arquivos, recibos ou estudo.
Desativados não recebem concessão nova nem leem o snapshot. Clientes têm somente SELECT
próprio com RLS e RPC de consulta sem argumento de usuário. Somente service_role/backend
confiável altera catálogo/assinatura/entitlements; segredo nunca entra no bundle. JSON,
AsyncStorage, metadata de usuário/JWT e papel master não concedem plano. Assinatura
active/trialing vigente resolve plano concedido; expirada/revogada/futura volta ao Free.

RPC saas_account_snapshot retorna versão, conta, fonte server_database, plano efetivo,
preço nullable, limites, uso, restante, features e estado/origem/prazos da assinatura.
Uso deriva de livros remotos vivos e metadata.size do Storage, incluindo objetos ainda
não limpos após tombstone/staging. Não deriva de fileSize declarado no JSON do livro.
Tamanho legado desconhecido retorna `null` para uso/restante de bytes e impede apenas
crescimento de Storage até reconciliação confiável; nunca inventar zero nem apagar objeto.

Quota de livros usa trigger AFTER para respeitar UPSERT/CAS existente; serializa crescimento
por lock do perfil. Quota de bytes usa constraint trigger DEFERRABLE INITIALLY DEFERRED:
a sonda INSERT de permissão do Storage é revertida antes do tamanho definitivo; somente
completion durável confirma bytes, com lock por conta e sem confiar em contentLength.
Testes locais cobrem probe/savepoint/rollback e completion, inclusive aumento por UPDATE.
Requer READ COMMITTED como no Data API. Storage HTTP e disputa real entre dispositivos
continuam pendentes; não inferir da simulação PostgreSQL que upload de produção foi validado.

Compatibilidade: dados acima da franquia permanecem legíveis; atualizar livros existentes,
progresso/estudo/organização e excluir continua permitido. Limita apenas novos livros
remotos e crescimento de bytes. Leitura/importação local não consulta plano e mantém os
guards Auth existentes. Falha de quota preserva outbox e permite retry da mesma intenção.
Não há migração do schema local, Reader refatorado nem engine Sync substituído.

Contrato tipado: src/domain/saas/accountPlan.ts. Consumo comum Web/Android:
src/data/saas/SupabaseAccountPlanRepository.ts, exposto por accountPlanRepository na
composição existente. Congela JWT por chamada, valida owner/epoch A→B→A, contrato e
restante; cancelamento e prazo cobrem sessão/fetch/corpo. Sem backend/contrato válido,
retorna source=unavailable/snapshot=null; não inventa Pro, Free ou franquias. Resolução
cliente é indicativa para UI; futuras operações premium devem repetir autorização no
backend. Não há cache persistido de entitlements nem UI de compra nesta etapa.

VALIDADO LOCALMENTE: npm run test:saas (PostgreSQL/PGlite real para migration/RLS,
transporte controlado Web/Android e outbox SQLite/OpenBook), typecheck e export:web.
Matriz crítica anterior passou 56/56 incluindo as duas suítes SaaS iniciais; suíte adicional
de compatibilidade também passou e integra test:critical. Não é prova de Auth/Storage HTTP,
concorrência de duas sessões PostgreSQL, navegador real desta etapa ou aparelho Android.
Próximo passo operacional: implantação explicitamente autorizada após inventário, seguida
de testes autenticados A/B/desativada, upload/download e limites concorrentes. Etapa 2
não iniciada. Nenhum APK, cobrança ou mudança em main.

### 6.2. Aldus Admin — Etapa 1.5 (15/10/2026)

IMPLEMENTADO LOCALMENTE / ATIVAÇÃO REMOTA PENDENTE. Área /admin no Expo Router, com
entrada em Ajustes somente após aldus_admin_session confirmar a associação no servidor.
Layout Web usa largura responsiva própria; o frame e os fluxos do Reader permanecem.
Dez seções: Visão Geral, Usuários, Assinaturas, Planos e Preços, Armazenamento, Métricas,
Configurações, Administradores, Auditoria e Saúde do Sistema. Há loading, vazio, erro,
acesso negado e backend indisponível. Nenhuma concessão administrativa por cache offline.

Migration NOVA 20261015194604_aldus_admin.sql depende de profiles, Library/recuperação,
hardening de conta ativa e SaaS Etapa 1. Não modifica migrations históricas nem recria
catálogo/assinaturas. Cria aldus_admin_members, aldus_admin_audit, aldus_plan_proposals,
aldus_price_history, aldus_system_settings e aldus_setting_history, com RLS e sem acesso
direto de clientes. Schema aldus_admin_private guarda helpers, revisões e recibos.
saas_plans recebe descrição comercial e preço anual nullable; assinaturas não são
reescritas por alteração de preço. Histórico comercial imutável registra vigência imediata;
preço cobrado permanece indisponível. Agendamento automático de preço futuro não existe.

OWNER administra associações, catálogo, configurações e operações delegáveis. ADMIN recebe
somente users.read/users.write/subscriptions.manage/metrics.read/audit.read concedidos pelo
OWNER. ADMIN não gerencia outros administradores nem amplia as próprias permissões;
operações sobre a própria associação são negadas. master/Free/Pro não concedem administração.
O conjunto de permissões permite futura evolução de funções Suporte/Financeiro, sem criá-las.

Backend: aldus_admin_session, aldus_admin_read e aldus_admin_change; comandos são allowlist
tipada, não editor SQL/JSON genérico. Cada chamada valida auth.uid, sessão Auth ainda
existente/não expirada, e-mail confirmado, perfil ativo e associação/permissão atuais.
Alterações exigem JWT aal2 validado pelo gateway, sessão aal2 ligada a fator TOTP ainda
verificado e AMR TOTP assinado há no máximo 10 minutos. Sem essas provas, bloqueia.
Frontend tem enrollment/challenge TOTP pelo SDK existente; o segredo do próprio enrollment
fica apenas no estado transitório. MFA real do projeto ainda precisa de validação remota.

Todas as alterações exigem motivo e confirmação textual do recurso no modal e no servidor.
Revisão esperada impede lost update; lock transacional serializa mudanças/último OWNER.
UUID de requisição + recibo evita duplicação após resposta perdida; retry revalida permissões.
Casos negados retornam erro sanitizado sem rethrow para preservar a auditoria fora do
sub-bloco revertido. Auditoria registra ator/recurso/ação/horário/resultado/motivo e mudanças
mínimas, sem payloads de livros, tokens ou e-mails desnecessários. Triggers impedem UPDATE/
DELETE de auditoria e históricos de preços/configuração. Administradores não têm acesso
direto à biblioteca privada de outra conta, arquivos, caminhos, notas ou impersonação.

Triggers em associação/perfil protegem o último OWNER ativo inclusive em escrita confiável.
O painel exige tratar associação administrativa separadamente antes de desativar uma conta
administrativa. Nenhuma exclusão definitiva foi implementada. Mudanças de plano/revogação
de benefício não apagam dados nem removem Sync/Storage básico do Free.
Desativar não apaga arquivos nem revoga leitura offline já autorizada pelo cache existente;
o controle administrativo e os contratos remotos de conta ativa não usam esse cache.

Bootstrap preparado: supabase/admin/bootstrap_aldus_owner.sql. Somente conexão confiável
ao banco, depois de autorização explícita, configura aldus.bootstrap_owner_uuid com UUID
real independentemente conferido em Auth. O helper privado exige que esse UUID corresponda
ao e-mail indicado pelo proprietário, confirmado, com perfil ativo, e que bootstrap ainda
não tenha ocorrido. Ausência/mismatch/e-mail não confirmado interrompe sem criar conta.
Não executado em produção; existência/UUID/verificação da conta indicada NÃO foram consultados.
O e-mail não participa de autorização no cliente. O contato legal público já existente
pode coincidir com ele e permanece somente contato, sem privilégio.

Usuários: paginação de 25, busca por nome/username/e-mail/UUID, filtro plano/status/cadastro,
detalhes mínimos de conta, permissões efetivas, assinatura separada, uso/franquias e
recibos Sync. Conta ativa pode receber Pro manual com expiração obrigatória, revogação e
entitlements premium_ temporários. OWNER altera associação/role/permissões de outras contas
verificadas e cria propostas de planos sem ativá-las. Interface não executa compras.

Métricas reais são consultas ao backend: cadastrados/novos por período, últimos logins
(não usuários ativos), Free/Pro efetivos, assinaturas vigentes/expiradas, registros de Pro
manual, livros remotos vivos, objetos/bytes, média por conta, recibos Sync e cadastros/dia.
Tamanhos desconhecidos resultam em bytes/média indisponíveis, nunca zero inventado.
MRR/ARR/receita/cancelamentos/churn/transações/eventos/reembolsos ficam null com
“Aguardando integração de pagamentos”. Concessão Pro manual não é venda. Conversão histórica
Free→Pro, usuários ativos e falhas Auth/Sync/processamento não têm medição e ficam null.
Saúde comprova apenas a consulta ao banco e o horário; logs externos/Drive/Storage HTTP/
deploys ficam indisponíveis até conectores/telemetria sanitizada e sondas autorizadas.

Configuração allowlist: app.notice é aplicado em runtime em Ajustes; app.public_name,
app.institutional_url, app.policy_notice, operation.maintenance_notice,
operation.supported_version e flags opcionais Community/Battle/premium/experimental são
armazenadas/versionadas, mas marcadas requires_deploy=true (sem alterar automaticamente
esses recursos nesta etapa). Interface permite restaurar revisão histórica criando nova
revisão. Franquias/preços/entitlements do catálogo são efetivos no backend imediatamente.
Nenhuma chave genérica pode alterar Auth, RLS, Storage, secrets ou direitos básicos Free.

Inventário SOMENTE LEITURA pelos plugins em 15/10: Supabase projeto cmivracxuihtmsbmtuec
ACTIVE_HEALTHY; ledger lista apenas 20261015144958 flashcard_battles,
20261015145012 private_account_library e 20261015145018 private_library_file_recovery.
Não comprova ausência de objetos de Auth fora do ledger. Hardening/SaaS/Admin não aparecem
nesse inventário. Vercel: pesquisa por projeto aldus na conta conectada retornou vazio;
não inferir ausência global de deployment ou monitoramento pronto. GitHub conectado
confirmou acesso ao repositório. Nenhum SQL administrativo remoto, DDL, conta real,
bootstrap, migration ou deploy foi executado pelo agente.

VALIDADO LOCALMENTE: typecheck/export Web, test:admin (PostgreSQL/PGlite real, contratos e
transporte controlado) e matriz crítica 59/59 incluindo Auth/SaaS/segurança/Reader/Library/
Community/Flashcards. test:admin:web usa app exportado → HTTP local → migrations PostgreSQL
reais; exercita OWNER/ADMIN/comum, rota direta, revogação de sessão, offline, concessão Pro,
preços/configuração com confirmação/auditoria e aviso em Ajustes. Capturas desktop/mobile
em .expo/admin-validation foram inspecionadas. Auth/JWT/TOTP dessas provas são fixtures,
não identidades reais; Promise.all/CAS local não prova disputa entre sessões PostgreSQL.

Ativação pendente: autorização explícita, inventário completo de objetos/ACL/RLS/Storage/
schemas Auth e mapeamento do ledger; aplicar somente incrementais ausentes na ordem; verificar
UUID/e-mail confirmado do proprietário e executar bootstrap confiável; habilitar e testar
TOTP real, HTTP A/B/revogação/último OWNER, ações concorrentes e auditoria. Não reaplicar
migrations históricas por hipótese. Atualização Android requer nova compilação/instalação
do app para incluir a rota/componentes; nenhum APK nem validação física nesta etapa.
Sem cobrança, provedor escolhido, gateway, SaaS Etapa 2 ou novo recurso de Reader.

## 7. Plano 18/11/2026: a leitura além do arquivo (PLANO, sem código)

Origem: análise competitiva do Livrim (relatório "Aldus × Livrim", revisão 2, 17/11). O dono aprovou planejar três
itens: livro sem arquivo com "Quero ler", importar CSV do Goodreads e card de trecho com capa e capítulo (este no
`reader.md`). Objetivo: o Aldus guardar toda a vida de leitura da pessoa, inclusive livros físicos ou de lojas com DRM,
sem criar persistência ou Sync paralelos e sem placar (regras de produto de 11/11).

### Inventário (18/11, `main` `00a3fb9`)
- `LibraryBook` é centrado em arquivo (`filePath`, `fileHash`, `mimeType`, `fileSize` obrigatórios); Reader, integridade,
  envio privado, remoção do aparelho e Sync de arquivo assumem que há arquivo.
- Organização (`BookOrganization`) já guarda título/autor/capa, favorito, coleções e `readingStatus`
  (`unread|reading|completed|interrupted`). `parseOrganizationRecord` **rejeita** estado desconhecido: um app antigo
  que receber um estado novo pelo Sync falha com "Estado de leitura inválido".
- Servidor: `library_private.library_apply` exige `payload.format in ('epub','pdf')` para `kind='book'`, e
  `saas_private.enforce_book_quota` conta toda linha `book` ativa no limite do plano. Organização exige linha `book`.
- `goodreadsCsv.ts` só exporta (colunas Title, Author, ISBN, ISBN13, My Rating, Number of Pages, Date Read, Date Added,
  Bookshelves, Exclusive Shelf, My Review, Private Notes), a partir do diário (`app/diary.tsx`).

### Fatia A · Livro sem arquivo e "Quero ler" (G)
- A1 (P) "Quero ler" para qualquer livro. Para não quebrar apps antigos, **não** é um quinto `readingStatus`: campo
  opcional novo na organização (ex. `wantToRead: true`), com teste do comportamento do parser antigo. Filtro "Quero ler"
  na Biblioteca; exportação Goodreads mapeia para `to-read`.
- A2 (M) Entidade "livro sem arquivo": `LibraryBook` com marcador explícito de origem (registro manual), sem caminho,
  hash nem tamanho; formato físico, e-book de outra loja ou audiolivro. Guardas em Reader (abre a ficha, não o leitor),
  integridade, envio/baixa de arquivo, remoção do aparelho e lote. Progresso manual (página, %, capítulo) fica na
  organização do livro, **nunca** no progresso de leitura do Reader (EPUB/PDF/Reflow seguem com posições próprias).
  Não entra no diário: diário só tem sessões medidas.
- A3 (M, remoto) Sync: migration incremental nova aceitando o formato sem arquivo (sem `remotePath`) e regra de cota
  conforme decisão do dono; testada em PGlite com as migrations reais. Aplicar exige autorização própria. Sem a
  migration, livro sem arquivo fica só no aparelho com aviso explícito.
- A4 (M) Tela: "Adicionar livro sem arquivo" no "+" da Biblioteca (título, autor, páginas opcionais, formato, estado,
  capa opcional da galeria); ficha com "Registrar progresso"; selo "Sem arquivo · Físico" no card.
- Testes: domínio (validação, mapeamentos), repositório por conta (A/B, dado ilegível preservado), guardas do Reader e
  do Sync, migration em PGlite, tela com react-test-renderer; recurso na lista de entrega.
- Risco: apps antigos em outro aparelho recebendo livro sem arquivo pelo Sync. Testar o parser antigo do payload de
  livro antes de liberar; na beta, pedir atualização a todos os testadores.

### Fatia B · Importar CSV do Goodreads (M, depende de A)
- Domínio: parser CSV (aspas, vírgulas e quebras de linha dentro de resenha), limite de 5 MB e de linhas, colunas
  obrigatórias Title e Author; erros por linha, sem abortar o arquivo inteiro.
- Mapeamento: `to-read` → Quero ler; `currently-reading` → Lendo; `read` → Concluído (data de leitura só se vier no
  arquivo); outras estantes → coleções. Nunca inventar data, nota ou páginas: campo vazio fica vazio.
- Casamento com a biblioteca: ISBN quando houver, senão título + autor normalizados; o que casa atualiza a organização
  do livro existente; o resto vira livro sem arquivo.
- Etapa de revisão antes de gravar (novos, já na biblioteca, ignorados com o motivo), com escolha em caso de conflito
  (manter o meu / usar o importado, como já faz a importação JSON); gravação em lote única.
- Nota e resenha: conforme decisão do dono (ignorar com aviso, ou guardar privadas).
- Testes: CSV real do formato Goodreads com casos ruins, revisão, conflito, A/B, cancelamento; recurso na lista.

### Ordem sugerida
C (card, P) → A1 → A2 → A4 → A3 (com autorização) → B. Cada item é um commit verde sozinho.

### Decisões do dono (18/11/2026)
1. Livro sem arquivo **não conta** no limite de livros do plano (a migration exclui esse formato da cota).
2. Livro sem arquivo vira um **catálogo geral só de metadados**: a pessoa busca qualquer livro (título, autor, ISBN),
   adiciona do jeito que quiser (quero ler, lendo, físico, outra loja) e, quando tiver o próprio arquivo, **anexa ao
   livro** e lê no Aldus. O catálogo traz só título, autor, capa, edição e páginas; nunca conteúdo nem link de download.
   O registro sincroniza com a conta: a migration entra no projeto e aplicar no servidor exige autorização própria.
3. Nota e resenha: **criar** o recurso. Proposta: estrelas de 1 a 5 e resenha **privadas** na ficha do livro, preenchidas
   à mão ou pelo CSV do Goodreads, e exportadas no CSV. Tornar públicas exige decisão futura (Comunidade sem teste real).
4. Capa no card de trecho **ligada por padrão**, com opção de ocultar.

### Ajustes no plano por causa das decisões
- A2/A4 passam a partir da **busca no catálogo** (com cadastro manual quando o livro não for encontrado) e ganham
  **A5 · Anexar o próprio arquivo** a um livro do catálogo: a importação normal vincula o arquivo ao registro existente,
  sem duplicar o livro nem perder estado, nota, resenha ou organização.
- Nova **fatia D · Nota e resenha privadas** (M): campos na organização do livro (sem placar, sem média pública),
  ficha do livro, exportação e importação no CSV (My Rating, My Review). Entra depois de A1 e antes de B.
- Ordem: C → A1 → catálogo (busca) → A2/A4 → D → A5 → A3 (com autorização) → B.

### Pendente
- Fonte dos metadados (serviço externo novo; as buscas saem do aparelho sem dados da conta; entra no texto de
  privacidade, que o dono aprova antes): Google Books com Open Library de reserva (recomendado) ou só Open Library.
  Conferir os termos de uso da fonte escolhida antes de implementar.
