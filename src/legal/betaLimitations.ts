import type { LegalDocument } from "./legalContent";
import { legalContactDescription } from "./legalConfig";

/**
 * "O que esperar desta beta" (texto aprovado pelo dono em 18/11/2026; fonte: docs/beta/limitacoes-da-beta.md). Antes de cada
 * nova turma de testadores, conferir cada item contra a build distribuída. Itens conferidos para a build de 18/11: login por
 * @usuário indisponível (função não implantada), "Excluir conta" presente, Comunidade em teste. O canal de relatos usa o contato
 * de suporte já aprovado e exibido no app.
 */
export const betaLimitationsDocument: LegalDocument = {
  title: "O que esperar desta beta",
  subtitle: "Obrigado por testar o Aldus. Esta é uma versão de testes: o app funciona, mas ainda está sendo construído.",
  sections: [
    { heading: "Onde o Aldus funciona", bullets: [
      "Android e navegador (Web). Não existe app para iPhone nesta fase. No iPhone, use o Aldus pelo navegador.",
      "Alguns recursos dependem do sistema do aparelho e podem se comportar de forma diferente de um modelo para outro.",
    ] },
    { heading: "Seus livros", bullets: [
      "O Aldus abre EPUB e PDF que você já tem: do seu aparelho, do seu Google Drive, de bibliotecas que você cadastrar ou do acervo de domínio público que vem com o app.",
      "Catálogo: na aba Descobrir você busca qualquer livro, navega por categorias, sorteia uma indicação, vê sugestões “Para você” calculadas no seu aparelho e guarda livros na estante mesmo sem o arquivo (físico, de outra loja ou audiolivro), em todos os seus aparelhos. As informações vêm do Google Books e do Open Library; alguns livros podem vir incompletos ou sem capa, e aí o Aldus desenha uma capa própria.",
      "Livros com proteção de loja (DRM) podem não abrir. É o caso da maioria dos livros comprados para Kindle e de algumas lojas de e-book. Isso não é um defeito que vamos corrigir: o Aldus não remove proteções.",
      "O Aldus não vende, não empresta e não envia arquivos de livros a outras pessoas. O que você compartilha são trechos em imagem, com limite de tamanho.",
      "PDF grande na Leitura Livre (o modo que transforma o PDF em texto corrido) pode levar alguns minutos para ficar pronto na primeira vez, principalmente em livros com centenas de páginas.",
      "Guarde uma cópia dos seus arquivos. A sincronização entre aparelhos ainda está em teste. Para grifos e notas, use também a exportação no painel de grifos de cada livro.",
    ] },
    { heading: "Conta e acesso", bullets: [
      "Cadastro por e-mail tem limite nesta fase. O serviço de e-mail que usamos durante a beta envia poucas mensagens por hora. Se o e-mail de confirmação ou de nova senha não chegar, espere um pouco e tente de novo, ou entre com sua conta Google.",
      "Entrar pelo @usuário pode não funcionar ainda. Use o e-mail ou a conta Google.",
      "Google Drive: enquanto o app não passa pela verificação do Google, só as contas cadastradas como testadoras conseguem conectar o Drive. Se quiser usar o Drive, peça para incluirmos o seu e-mail.",
      "Excluir a conta: em Conta → Excluir conta. Os dados da conta saem do servidor; as cópias guardadas no aparelho continuam lá até você remover o app.",
    ] },
    { heading: "Servidor", paragraphs: [
      "Durante a beta, o servidor do Aldus roda num plano gratuito. Ele pode ficar lento ou indisponível por alguns períodos, e não há cópia de segurança diária no servidor. Mais um motivo para manter seus arquivos guardados.",
    ] },
    { heading: "Comunidade", bullets: [
      "Pessoas, clubes e fóruns estão em teste e podem ficar indisponíveis ou mudar.",
      "As denúncias são registradas, mas a análise ainda é feita manualmente e pode demorar.",
    ] },
    { heading: "O que o Aldus não faz, de propósito", bullets: [
      "Sem ofensiva, sem ranking e sem comparação entre leitores. Os números que o app mostra vêm do que você realmente leu, e você pode ocultá-los.",
      "Sem anúncios e sem links de compra.",
      "Sem coleta de estatísticas de uso nesta fase. Por isso dependemos do seu relato para saber o que melhorar.",
    ] },
    { heading: "Como nos ajudar", bullets: [
      "Conte o que aconteceu, o que você esperava e, se puder, mande uma captura de tela.",
      "Diga o modelo do aparelho e a versão do Android.",
      `Canal para relatos: ${legalContactDescription()}`,
    ] },
  ],
};
