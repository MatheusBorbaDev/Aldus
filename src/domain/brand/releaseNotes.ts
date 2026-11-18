/**
 * Novidades mostradas uma vez por versão ao abrir o app (pedido do dono em 18/11/2026: "pop upzinho bonitinho de patch notes",
 * com o aviso de beta e o link para o texto de limitações). Só entra o que está de fato nesta versão; o que é só Android é dito.
 */
export interface ReleaseNotes { id: string; date: string; items: readonly string[] }

export const RELEASE_NOTES: ReleaseNotes = {
  id: "2026-11-18",
  date: "18 de novembro de 2026",
  items: [
    "Cara nova: ícone e abertura do Aldus, e uma capa desenhada para cada livro que não tem capa.",
    "Buscar qualquer livro: ache pelo título, autor ou ISBN e guarde na estante como Quero ler, mesmo sem o arquivo. Por enquanto, esses livros ficam só neste aparelho.",
    "Google Drive: no Android, o acesso se renova sozinho, sem pedir para reconectar a toda hora. E agora você escolhe a pasta navegando, sem colar link.",
    "Grifar ficou mais simples: cores, Nota, Card e Ajustar numa barra compacta, com início e fim do trecho ajustáveis.",
    "O card de trecho traz a capa do livro e o capítulo, e a tela de compartilhar ficou mais clara.",
    "Animação de folhear mais leve, e o grifo passou a funcionar em todas as páginas de livros longos.",
    "Excluir conta: em Conta → Excluir conta, com confirmação em dois passos.",
  ],
};

export const RELEASE_NOTES_SEEN_KEY = "@aldus/release-notes-seen.v1";

/** Mostra quando a pessoa ainda não viu estas novidades. Sem leitura confiável, não mostra (não insistir). */
export function shouldShowReleaseNotes(seen: string | null | undefined, readFailed: boolean, notes: ReleaseNotes = RELEASE_NOTES): boolean {
  return !readFailed && seen !== notes.id;
}
