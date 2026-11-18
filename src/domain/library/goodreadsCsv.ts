import { ReadingStatus } from "@/src/domain/types/libraryOrganization";

/**
 * Exportação CSV no padrão de importação do Goodreads (FASE 3, B2). Só dados reais do Aldus: título, autor, data em que o livro
 * entrou na biblioteca, situação de leitura, coleções e, desde 18/11/2026, a nota e a resenha pessoais quando a pessoa as escreveu.
 * ISBN, páginas e data de conclusão não existem aqui e ficam vazios (nunca estimados). O arquivo nunca leva o livro, notas ou grifos.
 */
export const GOODREADS_COLUMNS = ["Title", "Author", "ISBN", "ISBN13", "My Rating", "Number of Pages", "Date Read", "Date Added", "Bookshelves", "Exclusive Shelf", "My Review", "Private Notes"] as const;

export interface GoodreadsBook { title: string; author: string | null; addedDate: number | null; status: ReadingStatus; collections: string[]; rating?: number | null; review?: string | null }

/** Estante exclusiva do Goodreads; "interrompido" vai também para Bookshelves (o Goodreads não tem essa situação). */
export function exclusiveShelf(status: ReadingStatus): "to-read" | "currently-reading" | "read" {
  return status === "completed" ? "read" : status === "unread" ? "to-read" : "currently-reading";
}

function goodreadsDate(timestamp: number | null): string {
  if (timestamp === null || !Number.isFinite(timestamp) || timestamp <= 0) return "";
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

/** Campo CSV (RFC 4180). Texto que começa com = + - @ ganha um apóstrofo para não virar fórmula numa planilha. */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function goodreadsCsv(books: GoodreadsBook[]): string {
  const rows = books.map(book => {
    const shelves = [...new Set([...(book.status === "interrupted" ? ["interrompido"] : []), ...book.collections.map(name => name.trim()).filter(Boolean)])];
    const values: Record<(typeof GOODREADS_COLUMNS)[number], string> = {
      "Title": book.title.trim(), "Author": book.author?.trim() ?? "", "ISBN": "", "ISBN13": "", "My Rating": book.rating && Number.isInteger(book.rating) && book.rating >= 1 && book.rating <= 5 ? String(book.rating) : "", "Number of Pages": "",
      "Date Read": "", "Date Added": goodreadsDate(book.addedDate), "Bookshelves": shelves.join(", "), "Exclusive Shelf": exclusiveShelf(book.status),
      "My Review": book.review?.trim() ?? "", "Private Notes": "",
    };
    return GOODREADS_COLUMNS.map(column => csvField(values[column])).join(",");
  });
  return [GOODREADS_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}
