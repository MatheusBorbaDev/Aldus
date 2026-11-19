import { isRecordBook, LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookOrganization } from "@/src/domain/types/libraryOrganization";
import { catalogKey, CatalogBook } from "./catalogBook";
import { isAldusCategory } from "./catalogShelves";

/**
 * Ligar um arquivo ao catálogo (A5, 18/11/2026). Pedido do dono: o livro importado depois se liga ao item do catálogo. Por arquivo,
 * a ligação só existe com confirmação da pessoa: o app encontra o par pelo título (e pelo autor, quando o arquivo tem um) e pergunta;
 * nunca junta sozinho.
 */
export interface CatalogLinkFields { catalogId: string; catalogCategories: string[]; catalogPages: number | null }

const CATALOG_ID = /^(?:ol|gb|wd|file|gr|isbn):[\w.-]{1,70}$/;

export function catalogLinkFields(book: CatalogBook): CatalogLinkFields {
  return { catalogId: book.id, catalogCategories: [...book.categories], catalogPages: book.pages };
}

/** Lê os campos de catálogo de um registro de fora (Sync); inválido fica de fora, nunca inventado. */
export function parseCatalogLinkFields(value: Record<string, unknown>): Partial<CatalogLinkFields> {
  const id = typeof value.catalogId === "string" && CATALOG_ID.test(value.catalogId) ? value.catalogId : null;
  if (!id) return {};
  const categories = Array.isArray(value.catalogCategories) ? [...new Set(value.catalogCategories.filter(isAldusCategory))].slice(0, 8) : [];
  const pages = typeof value.catalogPages === "number" && Number.isInteger(value.catalogPages) && value.catalogPages > 0 && value.catalogPages < 100000 ? value.catalogPages : null;
  return { catalogId: id, catalogCategories: categories, catalogPages: pages };
}

/** Campos de catálogo que vão no Sync de qualquer livro (com ou sem arquivo). */
export function catalogSyncFields(book: LibraryBook): Partial<CatalogLinkFields> {
  return book.catalogId ? { catalogId: book.catalogId, catalogCategories: book.catalogCategories ?? [], catalogPages: book.catalogPages ?? null } : {};
}

const UNKNOWN_AUTHORS = new Set(["", "arquivo local", "autor desconhecido", "autor nao informado", "unknown"]);
const authorKeys = (author: string) => catalogKey(author).split(" ").filter(part => part.length > 2);

/**
 * Livros guardados sem arquivo que parecem ser este arquivo: mesmo título normalizado e, se os dois têm autor conhecido, ao menos
 * um sobrenome em comum. Arquivo já ligado ou sem título não tem par.
 */
export function recordMatchesForFile(file: LibraryBook, books: LibraryBook[]): LibraryBook[] {
  if (isRecordBook(file) || file.isDeleted || file.catalogId || file.importComplete === false) return [];
  const title = catalogKey(file.title);
  if (title.length < 2) return [];
  const fileAuthor = catalogKey(file.author);
  return books.filter(record => {
    if (!isRecordBook(record) || record.isDeleted || catalogKey(record.title) !== title) return false;
    const recordAuthor = catalogKey(record.author);
    if (UNKNOWN_AUTHORS.has(fileAuthor) || UNKNOWN_AUTHORS.has(recordAuthor)) return true;
    const names = new Set(authorKeys(record.author));
    return authorKeys(file.author).some(part => names.has(part));
  });
}

/** Pares arquivo ↔ livro guardado que ainda não foram respondidos (um par por arquivo, só quando há um único candidato). */
export function pendingCatalogLinks(books: LibraryBook[], dismissed: ReadonlySet<string>): Array<{ file: LibraryBook; record: LibraryBook }> {
  const out: Array<{ file: LibraryBook; record: LibraryBook }> = [];
  for (const file of books) {
    const matches = recordMatchesForFile(file, books);
    if (matches.length === 1 && !dismissed.has(linkKey(file.id, matches[0].id))) out.push({ file, record: matches[0] });
  }
  return out;
}
export const linkKey = (fileId: string, recordId: string) => `${fileId}|${recordId}`;

/**
 * Organização do arquivo depois de juntar: o que a pessoa já marcou no arquivo vence; o que só existia no livro guardado vem junto
 * (estado, Quero ler, favorito, coleções, etiquetas, série, nota e resenha). "Quero ler" sai quando o livro já está lido ou em leitura.
 */
export function mergeLinkedOrganization(fileId: string, file: BookOrganization | undefined, record: BookOrganization | undefined, now: number): BookOrganization {
  const readingStatus = file?.readingStatus ?? record?.readingStatus ?? null;
  const wantToRead = (file?.wantToRead || record?.wantToRead) && readingStatus !== "completed" && readingStatus !== "reading";
  const pick = <K extends keyof BookOrganization>(key: K) => (file?.[key] !== undefined && file?.[key] !== null && file?.[key] !== "" ? file?.[key] : record?.[key]);
  return {
    ...(record ?? {}), ...(file ?? {}), bookId: fileId,
    favorite: !!(file?.favorite || record?.favorite),
    collections: [...new Set([...(file?.collections ?? []), ...(record?.collections ?? [])])],
    tags: [...new Set([...(file?.tags ?? []), ...(record?.tags ?? [])])],
    series: (pick("series") as string | undefined) ?? "", volume: (pick("volume") as number | null | undefined) ?? null,
    readingStatus,
    ...(wantToRead ? { wantToRead: true } : { wantToRead: undefined }),
    updatedAt: now, revision: (file?.revision ?? 0) + 1,
  };
}
