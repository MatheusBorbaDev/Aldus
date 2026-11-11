import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookOrganization, inferredReadingStatus, OrganizationRecords } from "@/src/domain/types/libraryOrganization";

/** Prazo a partir do qual um livro em leitura é considerado parado (30 dias). */
export const STALLED_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Última atividade de leitura medida: abertura ou gravação de progresso. 0 quando não há registro (nunca uma data inventada).
 */
export function lastReadingActivity(book: LibraryBook): number {
  return Math.max(book.lastOpenedDate ?? 0, book.lastReadAt ?? 0);
}

/** Livros com atividade registrada e não concluídos, do mais recente para o mais antigo ("Continue lendo"). */
export function recentReads(books: LibraryBook[], organization: OrganizationRecords, limit = 3): LibraryBook[] {
  return books
    .filter(book => lastReadingActivity(book) > 0 && inferredReadingStatus(book, organization[book.id]) !== "completed")
    .sort((a, b) => lastReadingActivity(b) - lastReadingActivity(a))
    .slice(0, Math.max(0, limit));
}

/**
 * Coleção automática "Parados": em leitura (situação inferida) com última atividade medida há mais de 30 dias.
 * Livro sem nenhuma atividade registrada não entra: não há como saber desde quando está parado.
 */
export function isStalled(book: LibraryBook, record: BookOrganization | undefined, now = Date.now()): boolean {
  const last = lastReadingActivity(book);
  return last > 0 && inferredReadingStatus(book, record) === "reading" && now - last > STALLED_AFTER_MS;
}
