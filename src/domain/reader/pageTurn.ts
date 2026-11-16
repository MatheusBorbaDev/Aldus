/**
 * Virada de página (Fase D, pedido do dono em 16/11/2026). "Deslizar" é o comportamento de sempre e continua o padrão;
 * "Folhear" gira a página como uma folha; "Sem animação" troca na hora. Reduzir movimento (sistema) força "Sem animação"
 * sem mudar a escolha salva. Vale para EPUB e Leitura Livre; o PDF Original troca de página como antes.
 */
export type PageTurn = "none" | "slide" | "flip";

export const PAGE_TURNS: ReadonlyArray<{ value: PageTurn; label: string }> = [
  { value: "none", label: "Sem animação" },
  { value: "slide", label: "Deslizar" },
  { value: "flip", label: "Folhear" },
];

export function isPageTurn(value: unknown): value is PageTurn {
  return value === "none" || value === "slide" || value === "flip";
}

/** O que o documento deve fazer: a escolha da pessoa, ou nada de movimento quando o sistema pede menos movimento. */
export function effectivePageTurn(choice: PageTurn, reduceMotion: boolean): PageTurn {
  return reduceMotion ? "none" : choice;
}
