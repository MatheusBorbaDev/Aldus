import { ReadingSessionRecord } from "@/src/domain/reader/readingSession";

/**
 * Cartão de foco (FASE 3, C). Mostra os minutos de leitura ativa medidos na sessão de foco. Título do livro só se a pessoa
 * ligar. Equivalência em páginas é ESTIMATIVA, rotulada como tal, e só existe com ritmo medido (mediana de ≥5 viradas de
 * página, readingPace); sem ritmo não há número. Compartilha texto, nunca o arquivo do livro. Sem ranking ou comparação.
 */
export interface FocusCardOptions {
  title: string | null;
  includeTitle: boolean;
  includeEstimate: boolean;
  secondsPerPage: number | null;
}

/** Páginas estimadas pelo ritmo medido; null sem ritmo ou abaixo de 1 página. */
export function estimatedPages(activeSeconds: number, secondsPerPage: number | null): number | null {
  if (secondsPerPage === null || !Number.isFinite(secondsPerPage) || secondsPerPage <= 0 || !Number.isFinite(activeSeconds) || activeSeconds <= 0) return null;
  const pages = Math.round(activeSeconds / secondsPerPage);
  return pages >= 1 ? pages : null;
}

export interface FocusCardContent { headline: string; title: string | null; estimate: string | null; footer: string }

export function focusCardContent(record: ReadingSessionRecord, options: FocusCardOptions): FocusCardContent {
  const minutes = Math.floor(record.activeSeconds / 60);
  const time = minutes < 1 ? "Menos de 1 min" : `${minutes} min`;
  const headline = `${time} de leitura com foco${record.focusGoalReached ? " · meta cumprida" : ""}`;
  const pages = options.includeEstimate ? estimatedPages(record.activeSeconds, options.secondsPerPage) : null;
  return {
    headline,
    title: options.includeTitle && options.title?.trim() ? `«${options.title.trim()}»` : null,
    estimate: pages === null ? null : `≈ ${pages} ${pages === 1 ? "página" : "páginas"} (estimativa pelo meu ritmo de leitura)`,
    footer: "Medido pelo Aldus: só tempo de leitura ativa.",
  };
}

export function focusCardText(content: FocusCardContent): string {
  return [content.headline, content.title, content.estimate, content.footer].filter(Boolean).join("\n");
}
