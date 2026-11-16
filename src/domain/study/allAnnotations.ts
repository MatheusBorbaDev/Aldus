import { Bookmark } from "@/src/domain/repositories/BookmarkRepository";
import { Highlight, HighlightColor } from "@/src/domain/repositories/HighlightRepository";
import { isPinned } from "@/src/domain/study/pinnedHighlights";

/**
 * "Todas as anotações" (FASE 3, A2): grifos, notas e marcadores de todos os livros da conta numa lista só. Junta o que os
 * repositórios já guardam por livro; não cria cópia, não sincroniza nada novo e não inventa capítulo ou data que não existam.
 */
export type AnnotationKind = "highlight" | "bookmark";
export interface AnnotationItem {
  key: string;
  kind: AnnotationKind;
  bookId: string;
  bookTitle: string;
  text: string;
  note: string | null;
  chapterTitle: string | null;
  color: HighlightColor | null;
  pinned: boolean;
  createdAt: number;
}

export interface AnnotationSource {
  book: { id: string; title: string };
  highlights: Highlight[];
  bookmarks: Bookmark[];
}

export function collectAnnotations(sources: AnnotationSource[], readHighlight: (highlight: Highlight) => { chapterTitle?: string; note?: string } | null): AnnotationItem[] {
  const items: AnnotationItem[] = [];
  for (const { book, highlights, bookmarks } of sources) {
    for (const highlight of highlights) {
      if (highlight.bookId !== book.id) continue;
      const location = readHighlight(highlight);
      items.push({ key: `h:${highlight.id}`, kind: "highlight", bookId: book.id, bookTitle: book.title, text: highlight.highlightedText,
        note: location?.note?.trim() || null, chapterTitle: location?.chapterTitle?.trim() || null, color: highlight.colorLabel,
        pinned: isPinned(highlight), createdAt: highlight.createdAt });
    }
    for (const bookmark of bookmarks) {
      if (bookmark.bookId !== book.id) continue;
      items.push({ key: `b:${bookmark.id}`, kind: "bookmark", bookId: book.id, bookTitle: book.title, text: bookmark.textPreview,
        note: bookmark.note?.trim() || null, chapterTitle: null, color: null, pinned: false, createdAt: bookmark.createdAt });
    }
  }
  return items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt || a.key.localeCompare(b.key));
}

export const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca sem diferenciar acentos e maiúsculas no trecho, na nota, no capítulo e no título do livro. */
export function filterAnnotations(items: AnnotationItem[], query: string, kind: AnnotationKind | "all" | "pinned"): AnnotationItem[] {
  const needle = normalizeSearch(query);
  return items.filter(item => (kind === "all" || (kind === "pinned" ? item.pinned : item.kind === kind))
    && (!needle || normalizeSearch([item.text, item.note ?? "", item.chapterTitle ?? "", item.bookTitle].join(" ")).includes(needle)));
}
