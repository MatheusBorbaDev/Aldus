# Aldus Reader na Google Play: ficha e respostas prontas

Preparado em 26/11/2026 a partir do código e da Política de Privacidade 0.13 (`src/legal/legalContent.ts`). O dono confere e cola no
Play Console. Itens marcados com **CONFERIR** dependem de decisão do dono ou de dado que o código não comprova.

## Dados do app

| Campo | Valor |
| --- | --- |
| Pacote | `com.aldus.reader` |
| Nome | Aldus Reader |
| Categoria | Livros e referências |
| Idioma padrão | Português (Brasil) |
| E-mail de contato | contato@aldusreader.com.br |
| Site | https://aldusreader.com.br |
| Política de privacidade | https://aldusreader.com.br/legal/privacy |
| Certificado de assinatura (upload) | `CN=Aldus Reader`, SHA-256 `a8ee8ec1bba51506c291a001f278ae633ca9faaf9f6eac483349e22c76c80f4a` |
| Ícone 512×512 | `assets/brand/icon-512.png` |
| Gratuito / anúncios | Gratuito; sem anúncios (o código não tem SDK de publicidade) |

## Textos da ficha

**Descrição curta** (até 80 caracteres):

> Leia seus EPUB e PDF, grife, anote e estude, no celular e no computador.

**Descrição completa** (até 4.000 caracteres):

> O Aldus Reader é um lugar calmo para ler os livros que você já tem.
>
> Abra seus EPUB e PDF, ajuste letra, margens e tema do jeito que seus olhos preferem, e continue de onde parou em qualquer aparelho:
> a biblioteca, o progresso, os grifos e as notas acompanham a sua conta entre o celular e o computador.
>
> LEIA DO SEU JEITO
> • EPUB com páginas, rolagem contínua ou animação de folhear.
> • PDF no formato original ou em Leitura Livre, com o texto refluído para a tela do celular.
> • Temas claro, escuro e sépia, textura de papel, fonte de alta legibilidade e ouvir em voz alta.
>
> GRIFE, ANOTE E COMPARTILHE
> • Grife com um toque longo, ajuste o trecho e guarde notas.
> • Transforme um trecho em imagem para compartilhar nas redes.
>
> ORGANIZE E ESTUDE
> • Coleções, etiquetas, estado de leitura e marcos para terminar um livro.
> • Listas de leituras obrigatórias de vestibulares, com obras em domínio público para baixar direto.
>
> SEUS ARQUIVOS, SOB SEU CONTROLE
> • Importe do aparelho ou de uma pasta do Google Drive compartilhada por link. O Aldus não acessa a sua conta Google.
> • Funciona sem internet para os livros já baixados.
> • Sem anúncios.
>
> O Aldus está em beta: algumas partes ainda vão mudar, e cada sugestão ajuda a decidir o que vem primeiro.

**CONFERIR:** a lista de recursos segue o que está no código em 26/11; tire o que não quiser anunciar.

## Segurança dos dados (formulário "Data safety")

Respostas derivadas da Política de Privacidade 0.13.

- **O app coleta ou compartilha dados do usuário?** Sim (coleta). **Compartilha com terceiros?** Não; Supabase e Google atuam como
  provedores do serviço, o que o formulário não conta como "compartilhamento".
- **Dados criptografados em trânsito?** Sim (HTTPS).
- **O usuário pode pedir exclusão?** Sim: no app, em Conta → Excluir conta.

| Tipo de dado (categoria do Google) | Coletado | Finalidade | Opcional? |
| --- | --- | --- | --- |
| Informações pessoais → E-mail | Sim | Funcionalidade do app; gerenciamento da conta | Obrigatório |
| Informações pessoais → Nome (nome de usuário e de exibição) | Sim | Funcionalidade do app; gerenciamento da conta | Obrigatório |
| Informações pessoais → IDs do usuário | Sim | Funcionalidade do app; gerenciamento da conta | Obrigatório |
| Arquivos e documentos (EPUB/PDF importados) | Sim | Funcionalidade do app (sincronização privada) | Opcional |
| Atividade no app → Outros conteúdos gerados pelo usuário (notas, grifos, resenhas) | Sim | Funcionalidade do app | Opcional |
| Atividade no app → Interações no app (progresso de leitura, estado de leitura) | Sim | Funcionalidade do app | Obrigatório para sincronizar |

Não coletados (conforme a política): localização, contatos, mensagens, fotos, áudio, dados financeiros, saúde, histórico de navegação,
analytics, publicidade e relatórios de falhas. Os sensores de movimento (anti-enjoo) são usados só em memória.
O ML Kit (OCR de PDF) pode enviar métricas técnicas de uso do SDK ao Google; **CONFERIR** na documentação do ML Kit se o formulário pede
declarar "Diagnóstico" por causa disso.
**CONFERIR:** a Comunidade (perfil e atividade visíveis a outros leitores) não aparece nesta tabela porque a política não a detalha;
se ela for publicada nesta versão, acrescentar "Outros conteúdos gerados pelo usuário" como dado visível a outros usuários.

## Classificação indicativa (questionário IARC)

Categoria: "Referência, notícias ou educação". Respostas esperadas: sem violência, sexo, linguagem imprópria, drogas, jogos de azar ou
compras. **CONFERIR:** o usuário pode importar qualquer livro e, se a Comunidade estiver ativa, há interação entre usuários; o IARC
pergunta sobre "interação entre usuários" e "conteúdo gerado pelo usuário": responder Sim se a Comunidade estiver no app publicado.

## Público-alvo

13 anos ou mais (a política tem seção própria sobre crianças e adolescentes). **CONFERIR** a idade mínima que o dono quer declarar.

## Teste fechado (exigência para conta pessoal nova)

Pelo menos 12 testadores inscritos no teste fechado por 14 dias seguidos antes de pedir acesso à produção. Os inscritos da beta
(convite por e-mail) podem entrar pela lista de e-mails do teste fechado no Play Console.

## Arquivo para a loja

A Play Store pede pacote AAB, não APK. O AAB sai do mesmo projeto (`android/`, tarefa `bundleRelease`) com a mesma chave; gerar quando a
conta do Play Console existir.
