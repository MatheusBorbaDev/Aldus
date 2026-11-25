/**
 * Leitor no PC (25/11/2026, dono: "coloca uma margenzinha, deixa bonitinho", com opção de uma página centralizada e de rolar).
 * O livro vira uma folha centralizada com margem em volta; a paginação do documento usa o tamanho da folha, então nada dentro do
 * documento muda. Fora do PC (celular, tablet, Android) não há folha: o documento ocupa a área toda, como sempre.
 */
export type DesktopReaderLayout = "spread" | "single" | "scroll";

/** Margem em volta da folha. Em cima e embaixo fica um respiro; dos lados, o resto da janela. */
// 25/11/2026 (dono: "as margens estão muito grandes"): respiro curto em volta; a margem do texto continua no ajuste "Margens".
export const DESKTOP_PAGE_MARGIN = { top: 14, bottom: 14, side: 24 } as const;
/** Largura máxima da folha: duas páginas, uma página e a rolagem (linha confortável de ler). */
export const DESKTOP_PAGE_WIDTH: Record<DesktopReaderLayout, number> = { spread: 1440, single: 820, scroll: 860 };

export interface DesktopReaderFrameInput {
  /** Área livre para o documento (janela menos os painéis encaixados ao lado). */
  width: number;
  height: number;
  layout: DesktopReaderLayout;
}

export interface DesktopReaderFrame { left: number; right: number; top: number; bottom: number; width: number; height: number }

export function desktopReaderLayout(flow: "paged" | "scroll", pages: "two" | "one", spreadFits: boolean): DesktopReaderLayout {
  if (flow === "scroll") return "scroll";
  return pages === "two" && spreadFits ? "spread" : "single";
}

/** Posição da folha dentro da área livre; na rolagem o texto corre dentro da folha. */
export function desktopReaderFrame({ width, height, layout }: DesktopReaderFrameInput): DesktopReaderFrame {
  const room = Math.max(0, width - DESKTOP_PAGE_MARGIN.side * 2);
  const pageWidth = Math.max(0, Math.min(DESKTOP_PAGE_WIDTH[layout], room));
  const side = Math.floor((width - pageWidth) / 2);
  // 25/11/2026 (dono, na rolagem: "coloca uma margemzinha em cima"): a folha tem respiro em cima e embaixo em todos os modos.
  const top = DESKTOP_PAGE_MARGIN.top;
  const bottom = DESKTOP_PAGE_MARGIN.bottom;
  return { left: side, right: width - pageWidth - side, top, bottom, width: pageWidth, height: Math.max(0, height - top - bottom) };
}
