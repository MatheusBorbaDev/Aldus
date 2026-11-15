# Armadilhas já encontradas (ambiente, testes e build)

Lista curta de erros reais deste projeto e de como evitá-los. Confirme no checkout antes de
confiar: caminhos e nomes mudam.

## Editar arquivos pelo shell

- Heredoc no Git Bash consome barras invertidas (`\d`, `\S`, caminhos do Windows) e se perde com
  crases e aspas. Para arquivos com `\`, expressões regulares ou texto longo, escreva com a
  ferramenta de escrita de arquivos ou rode um script salvo fora do repositório.
- Vários arquivos estão em CRLF no checkout. Substituição por âncora de várias linhas precisa
  normalizar `\r\n` para `\n`, aplicar e devolver o formato; senão a âncora não casa.
- Script temporário com nome genérico já foi executado por engano no lugar de outro. Use nomes
  únicos e apague o temporário do repositório ao terminar.

## Código dentro de strings

- O documento do Reader (`EpubReaderDocument.ts`) contém JavaScript dentro de uma template string.
  Uma barra invertida ali some (um `\S` virou `/S/`). Evite regex nesse trecho ou teste o resultado.
- Função usada no host e dentro do iframe tem duas cópias; `scripts/test-reader-bytecode.cjs`
  confere a paridade. Acrescentou um auxiliar? Inclua-o nessa conferência.

## Simulados que precisam acompanhar o código

- `ReaderSettingsPanel` é carregado com módulos simulados em `scripts/test-reader-settings-categories.cjs`
  e em `scripts/build-reader-settings-web-fixture.cjs`. Import novo no painel exige entrada nos dois,
  senão o painel quebra só no teste ("Cannot read properties of undefined").
- O `CommunityProvider` é testado com `../adapters/runtime` simulado em `scripts/test-community-provider.cjs`.
  Função nova exportada pelo runtime precisa existir no simulado.
- `ReaderScreen` é renderizado em `scripts/test-reader-screen.cjs` e `scripts/test-reader-navigation.cjs` com
  `react-native` simulado. Componente novo renderizado sempre (um `Modal`, por exemplo) quebra essas
  suítes; monte-o só quando estiver aberto.
- Módulo com `import X from` transpilado sem interop usa `__importDefault`: o simulado precisa de
  `__esModule: true` além de `default`.
- Dois carregadores de módulos criam duas classes de erro diferentes; `instanceof` falha entre eles.
  No teste, lance o erro com a classe do mesmo carregador que a tela usa.

## Testes de navegador

- O documento do Reader tem CSP com nonce sorteado. `Page.setDocumentContent` troca o conteúdo na mesma página e mantém a CSP
  `<meta>` do primeiro documento: o script do segundo é bloqueado e sobra o antigo. Em testes que trocam o documento, passe
  `scriptNonce` fixo nas opções de `createEpubReaderDocument`. Para achar o script gerado, procure `<script nonce="…">`.
- `test:legal:browser` não sobe o próprio Chrome: espera um na porta 9333 e um preview na 4877 (`LEGAL_PREVIEW_CDP_URL`).
- Neste Windows, `test:marketing:web` precisa de `CINEMATIC_CHROME_ANGLE=d3d11`.
- Suítes que escrevem em `dist` ou no mesmo perfil rodam em sequência, depois de `export:web`.
- Asserção que depende de arredondamento de geometria é frágil: um toque a 25% do slider caía em
  16,5 e mudou de valor quando o painel ganhou barra de rolagem. Mire o valor pela fórmula do
  componente, não por uma fração da largura.
- Captura por linha de comando com janela estreita pode cortar a página sem que haja estouro real.
  Meça `scrollWidth` contra `innerWidth` no navegador controlado antes de "corrigir" o layout.
- No RN Web, `flex: 0` prende a altura do item; para um item que deve crescer com o texto use
  `flexGrow: 0, flexShrink: 0, flexBasis: "auto"`.

## Build Android

- `android/app/build/generated/res/react/release/raw` guarda recursos de builds anteriores. Depois
  de remover assets (livros, imagens), apague essa pasta de saída antes de compilar; senão o APK
  sai com os arquivos removidos. Confira sempre a lista de arquivos do APK.
- O bundle Hermes guarda textos acentuados em UTF-16. Para confirmar um texto no APK, procure nas
  duas codificações.
- `android/local.properties` escrito por heredoc perde as barras; o Gradle falha com erro de
  sintaxe de caminho. Use barras normais.

## Dados e textos

- `fileHash` do livro pertence ao Sync e ao envio privado. Guardar ali um hash calculado para
  outro fim muda quando o arquivo é enviado; use um índice separado.
- O export Web recusa arquivo em `assets/Livros` que não esteja declarado em domínio público ou
  que pertença ao acervo antigo. Não contorne a guarda: declare o livro com fonte e licença.
- Texto legal mudou? Suba `LEGAL_DOCUMENT_VERSION` e a data de vigência, e trave a frase em
  `scripts/test-legal.cjs`. A política de dados ainda precisa citar o que cada recurso novo guarda.
