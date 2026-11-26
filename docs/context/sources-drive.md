# Sources e Google Drive

> Módulo de referência. Ler ao mexer em fontes, catálogos, Drive ou aquisição.
> Texto preservado do PROJECT_CONTEXT.md original (2192 linhas, escrito pelo Codex), movido sem reescrita em 06/11/2026. Trate como hipótese: confira Git/código antes de confiar. O estado atual e as pendências estão em [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md).

## 7. Sources

Source Library é catálogo da fonte, separado da biblioteca pessoal. Configuração local e
snapshot metadata persistem em SQLite/IndexedDB; vínculos sourceId+remoteBookId→bookId
sobrevivem ao reload. Remover fonte elimina configuração/snapshot/vínculos, preservando
livros importados e seus dados. Não vincular importação antiga por coincidência de título.

Catálogo completo: Drive EPUB/PDF e JSON V1 estático EPUB, array ou books[], sem paginação
oculta. Gutendex/Gutenberg/OPDS/HTML parametrizado são pesquisa/aquisição, sem simular estante
completa. Resposta inválida não vira catálogo vazio. APIs não passam por robots de scraping;
HTML respeita a política da fonte. Project Gutenberg usa OPDS/aquisição explícita e contato
EXPO_PUBLIC_CATALOG_CONTACT. BibliON/MEC são serviços WebView independentes.

Snapshots schemaVersion2 guardam rootFolderId/folders+books atomicamente, com rollback,
identidade de fonte e gerações. Busca fuzzy local compartilha catalogRanking, tokens Unicode,
diacríticos, prefixos e uma edição/transposição conservadora; índice preparado por snapshot.
Grade/lista virtualizadas, breadcrumbs e busca source-wide mostram caminho e ações.
Listar/pesquisar nunca baixa EPUB/PDF nem envia uma chamada Drive por tecla.
CORS da aquisição difere de CORS da busca; não usar proxy/no-cors para fingir suporte.

## 8. Google Drive

> **26/11/2026 (substitui o texto abaixo sobre autorização):** o Drive é lido **só pelo link colado**, sem conta Google. A pasta precisa
> estar compartilhada como "Qualquer pessoa com o link"; as consultas levam a chave pública do app (`EXPO_PUBLIC_GOOGLE_DRIVE_API_KEY`,
> restrita à API do Drive, chave "Aldus - Drive por link" no projeto Google Cloud) no cabeçalho `X-Goog-Api-Key`, nunca na URL guardada.
> Saíram: `DriveAuthorization`, `drivePlatformAuth`, o módulo nativo `aldus-drive-auth`, o seletor de pastas e o escopo `drive.readonly`
> (removido também da tela de consentimento; a Central de verificação diz que não é necessária verificação). Pasta privada responde 404
> e o app explica como compartilhar pelo link. Prova ao vivo 26/11: pasta de referência listada e um EPUB de 2,2 MB baixado só com a chave.

Login Google Supabase autentica o Aldus; autorização Drive é outro contrato.
Android: módulo aldus-drive-auth, AuthorizationClient/PendingIntent/ActivityResult, package
e certificado corretos. Web: GIS token model, Client ID público e gesto de usuário.
Scope apenas https://www.googleapis.com/auth/drive.readonly; sem secret nem provider token
Supabase reaproveitado. Grants ficam em memória, expiram e pedem reconexão; cache SDK e
revogação best effort não garantem seletor de outra conta.

GoogleDriveService valida raiz por metadata e faz BFS paginada de pastas/subpastas/atalhos
de pasta alcançados, IDs reais, resource keys, Shared Drive e proteção de ciclos/aliases.
Não lista todo o Drive nem exige que a conta seja dona da pasta compartilhada.
Destinos externos só por atalho encontrado e permissão existente. Atalhos para arquivos e
exportar Google Docs ainda não são suportados; não anunciá-los como implementados.
ROOT real de referência: 1PwrGP2UiCNGhyhvhDUpszZZwFjfkjaw4.

Refresh publica árvore completa ou conserva snapshot anterior; erro de ramo não é sucesso
parcial. O crawl continua serial e pode levar tempo; não foi substituído por outro crawler.
Cancelamento do modal/store chega ao catálogo, leitura/lookup e rede. Fonte removida/alterada
termina em erro. Escrita nativa iniciada permanece na fila até terminar, mas não publica
resultado cancelado nem ultrapassa a geração nova. O modal oferece Cancelar indexação e
mostra o erro do catálogo em vez de inferir sucesso pelo grant.

Usuário relata login Google funcionando; a causa exata da tentativa física de indexação
continua sem trace. Não reabrir OAuth sem evidência nova. [GOOGLE_AUTH_DRIVE_DEPLOYMENT.md](GOOGLE_AUTH_DRIVE_DEPLOYMENT.md)
é roteiro operacional de configuração/teste, não checkpoint do estado atual.
Página pública de pasta não comprova files.list autenticado nem importação no Aldus.

Missão integrada: mudança síncrona do LibraryAccountScope limpa todos os grants e índices
Drive em memória, incluindo consentimentos pendentes; retorno antigo não pode autorizar B.
Snapshots/configuração Sources continuam DEVICE-scoped, não são promessa de isolamento
persistido por conta; não atribuir automaticamente os legados a uma identidade.

### 8.x Renovação silenciosa (18/11/2026, `67457a5`)
Relato do dono: o Drive "fica desconectando e precisa reconectar a toda hora". Causa: o grant vivia só na memória por
~45 min; vencimento ou reabertura do app levavam a "Reconecte o Google Drive". Agora a fonte guarda `driveAccountId`
(Drive `about.user.permissionId`, nunca o e-mail) e `GoogleDriveService.ensureAuthorized` renova sem tela antes de
listar, descrever a pasta ou baixar: Android chama o AuthorizationClient com `interactive=false` (com `hasResolution`,
falha como `DRIVE_AUTH_REQUIRED`, sem abrir janela); a Web não renova em silêncio (o Google exige toque) e reconecta sem o
seletor de conta (`prompt: ""`). Token de outra conta Google é descartado e limpo; fonte antiga sem conta gravada
reconecta uma vez; chamadas simultâneas dividem uma renovação; troca de conta do Aldus descarta token atrasado; 401 no
meio da leitura das pastas renova uma vez e recomeça. Reconexão manual de fonte conhecida só aceita a mesma conta
(`account-mismatch`). Teste `test-drive-renewal` (critical). NÃO TESTADO: aparelho e conta Google real; o módulo
Kotlin mudou e exige APK novo. Limite possível: com o app Google em modo de teste, a permissão pode vencer de vez após
alguns dias (a confirmar no aparelho).

### 8.y Escolher a pasta e biblioteca mais quieta (18/11/2026, `f5027c7`, `3409563`)
Depois de conectar, "Escolha uma pasta" lista só pastas (e atalhos para pastas) de Meu Drive ou Compartilhados comigo, um nível por
vez, com caminho, "Carregar mais" e "Usar a pasta"; a raiz de cada área não pode ser escolhida (nunca ler o Drive inteiro). IDs e chaves
de recurso são validados antes de entrar na consulta. Colar o link continua em "Prefiro colar o link de uma pasta". Na biblioteca, o aviso
de reconectar e o de sem conexão viraram uma faixa fina; a ordenação é um botão com menu; "Conectado" aparece só com acesso válido agora.
Testes: `test-drive-folder-picker` (critical), `test-source-ui`, `test:source-library:browser`. NÃO TESTADO: Drive real e aparelho.
