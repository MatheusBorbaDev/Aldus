import { LibraryBook, RECORD_BOOK_MIME, RECORD_BOOK_PREFIX } from "@/src/domain/entities/LibraryBook";
import { BookOrganization, ManualProgress } from "@/src/domain/types/libraryOrganization";
import { CatalogBook } from "./catalogBook";

/** Como a pessoa quer guardar o livro ao adicioná-lo do catálogo. */
export type RecordBookStart = "want" | "reading" | "completed";
export type RecordBookFormat = NonNullable<LibraryBook["recordFormat"]>;
export const RECORD_FORMAT_LABELS: Record<RecordBookFormat, string> = { physical: "Livro físico", ebook: "E-book de outra loja", audiobook: "Audiolivro" };
export const RECORD_START_LABELS: Record<RecordBookStart, string> = { want: "Quero ler", reading: "Estou lendo", completed: "Já li" };

/**
 * Livro sem arquivo a partir de um item do catálogo (fase 2, 18/11/2026). Só metadados: sem caminho, hash, tamanho nem capítulos;
 * a capa é a do catálogo (endereço do Open Library) ou, sem ela, a capa padrão Aldus desenhada no aparelho.
 */
export function createRecordBook(input: { catalog: CatalogBook; format: RecordBookFormat; id: string; now: number }): LibraryBook {
  if (!/^[\w-]{8,64}$/.test(input.id)) throw new Error("Identificador inválido.");
  return {
    id: RECORD_BOOK_PREFIX + input.id, kind: "record", catalogId: input.catalog.id, recordFormat: input.format,
    catalogCategories: [...input.catalog.categories], catalogPages: input.catalog.pages,
    title: input.catalog.title, author: input.catalog.authors.join(", ") || "Autor não informado",
    fileName: "", filePath: "", fileHash: null, mimeType: RECORD_BOOK_MIME, fileSize: 0,
    coverImagePath: input.catalog.coverUrl, totalChapters: 0, totalWords: 0,
    addedDate: input.now, lastOpenedDate: null, isDeleted: false, progress: 0, importComplete: true,
  };
}

/** Organização inicial: "Quero ler" é o campo próprio; "Estou lendo" e "Já li" usam os estados que já existem. */
export function recordBookOrganization(bookId: string, start: RecordBookStart, now: number): BookOrganization {
  return {
    bookId, favorite: false, collections: [], tags: [], series: "", volume: null,
    readingStatus: start === "reading" ? "reading" : start === "completed" ? "completed" : null,
    ...(start === "want" ? { wantToRead: true } : {}),
    updatedAt: now, revision: 1,
  };
}

/** Livros da biblioteca que vieram deste item do catálogo (para dizer "Na sua biblioteca" e não duplicar). */
export function libraryMatchesForCatalog(books: LibraryBook[], catalogId: string): LibraryBook[] {
  return books.filter(book => !book.isDeleted && book.catalogId === catalogId);
}

/** Fração lida de um livro sem arquivo, a partir do que a pessoa informou; sem total, não há fração (null, nunca estimada). */
export function manualProgressFraction(progress: ManualProgress | undefined): number | null {
  if (!progress || !progress.totalPages) return null;
  return Math.max(0, Math.min(1, progress.page / progress.totalPages));
}

/** Texto curto do progresso informado: "p. 120 de 300", "45%" no audiolivro, "p. 120" sem total. */
export function manualProgressLabel(progress: ManualProgress | undefined, format: RecordBookFormat | undefined): string | null {
  if (!progress) return null;
  if (format === "audiobook") return progress.totalPages === 100 ? `${progress.page}%` : null;
  return progress.totalPages ? `p. ${progress.page} de ${progress.totalPages}` : `p. ${progress.page}`;
}
