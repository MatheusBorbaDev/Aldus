import { Highlight } from "@/src/domain/repositories/HighlightRepository";

/**
 * Trechos fixados (FASE 3, A1). Fixar é uma marca do grifo (`pinned`), salva com ele e enviada pelo Sync como o resto do
 * grifo; ausente vale como não fixado, então grifos antigos e de outros aparelhos continuam válidos.
 */
export const isPinned = (highlight: Pick<Highlight, "pinned">): boolean => highlight.pinned === true;

/** Fixados primeiro; dentro de cada grupo, o mais recente primeiro (a ordem que o painel já usava). */
export function orderHighlights<T extends Pick<Highlight, "pinned" | "createdAt" | "id">>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

export function withPinned(highlight: Highlight, pinned: boolean): Highlight {
  return { ...highlight, pinned };
}
