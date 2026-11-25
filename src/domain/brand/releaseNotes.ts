/**
 * Aviso mostrado uma vez por versão ao abrir o app (pedido do dono em 18/11/2026: "pop upzinho bonitinho de patch notes",
 * com o aviso de beta e o link para o texto de limitações). Só entra o que está de fato nesta versão; o que é só Android é dito.
 */
/**
 * 25/11/2026 (dono: "apaga o que tem no texto de novidades, por enquanto ... enquanto tá no beta, dá uma leve explicação de como o
 * app funciona"): durante a beta o aviso traz um guia curto no lugar da lista de mudanças. Cada item descreve o que existe hoje.
 */
export interface ReleaseNotes { id: string; date: string; title: string; heading: string; items: readonly string[] }

export const RELEASE_NOTES: ReleaseNotes = {
  id: "2026-11-25.1",
  date: "25 de novembro de 2026",
  title: "Boas-vindas ao Aldus",
  heading: "COMO O ALDUS FUNCIONA",
  items: [
    "Seus livros: o Aldus abre EPUB e PDF que você já tem, do aparelho, do Google Drive ou do acervo de domínio público que vem com o app. Tudo fica na Biblioteca.",
    "Ler: toque nas laterais da página para avançar ou voltar e no meio para mostrar os controles. Em Aparência você escolhe letra, tema, margens e se prefere virar páginas ou rolar.",
    "Grifar: segure o dedo sobre uma palavra e arraste até o fim do trecho. Depois escolha a cor, escreva uma nota ou crie um card.",
    "PDF: o Original mostra a página como foi impressa; a Leitura Livre transforma o PDF em texto corrido, para ajustar a letra como num EPUB.",
    "Descobrir: busque qualquer livro, veja sugestões e guarde na estante até os que você não tem em arquivo.",
    "Sua conta: progresso, grifos e notas acompanham você no celular e no navegador. A sincronização ainda está em teste, então guarde uma cópia dos seus arquivos.",
  ],
};

export const RELEASE_NOTES_SEEN_KEY = "@aldus/release-notes-seen.v1";

/** Mostra quando a pessoa ainda não viu estas novidades. Sem leitura confiável, não mostra (não insistir). */
export function shouldShowReleaseNotes(seen: string | null | undefined, readFailed: boolean, notes: ReleaseNotes = RELEASE_NOTES): boolean {
  return !readFailed && seen !== notes.id;
}
