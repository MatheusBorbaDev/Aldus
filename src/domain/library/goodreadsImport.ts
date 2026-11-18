import { catalogKey, CatalogBook, normalizeIsbn } from "@/src/domain/catalog/catalogBook";
import { RecordBookStart } from "@/src/domain/catalog/recordBook";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";

/**
 * Importar a estante do Goodreads (B, 18/11/2026). O CSV que o Goodreads exporta vira, depois de a pessoa revisar, livros sem arquivo
 * com estante, nota, resenha e coleções. Tudo no aparelho: o arquivo não é enviado a ninguém. Só o que está no CSV entra; nada é
 * completado por estimativa.
 */
export interface GoodreadsCandidate {
  key: string;
  title: string;
  author: string;
  isbn13: string | null;
  goodreadsId: string | null;
  pages: number | null;
  rating: number | null;
  review: string | null;
  start: RecordBookStart | "interrupted";
  collections: string[];
  /** Já existe livro com o mesmo título e autor: começa desmarcado. */
  inLibrary: boolean;
}

export const GOODREADS_MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;

/** CSV (RFC 4180): aspas, aspas duplas escapadas, vírgulas e quebras de linha dentro de campos, CRLF ou LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') { if (source[index + 1] === '"') { field += '"'; index++; } else quoted = false; }
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field); field = ""; rows.push(row); row = [];
      if (rows.length > MAX_ROWS + 1) throw new Error("O arquivo tem mais de 10 mil livros.");
    } else field += char;
  }
  if (quoted) throw new Error("O arquivo CSV está incompleto (aspas sem fechar).");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(values => values.some(value => value.trim()));
}

const SHELF_STARTS: Record<string, GoodreadsCandidate["start"]> = { "to-read": "want", "currently-reading": "reading", read: "completed" };
const EXCLUSIVE = new Set(["to-read", "currently-reading", "read"]);

/** Lê o CSV do Goodreads. Exige as colunas Title e Exclusive Shelf; linhas sem título ficam de fora. */
export function parseGoodreadsCsv(text: string, library: LibraryBook[]): GoodreadsCandidate[] {
  if (text.length > GOODREADS_MAX_BYTES) throw new Error("O arquivo passa de 5 MB.");
  const [header, ...rows] = parseCsv(text);
  const column = (name: string) => header?.findIndex(value => value.trim().toLowerCase() === name.toLowerCase()) ?? -1;
  const at = { title: column("Title"), author: column("Author"), isbn: column("ISBN"), isbn13: column("ISBN13"), rating: column("My Rating"),
    pages: column("Number of Pages"), shelf: column("Exclusive Shelf"), shelves: column("Bookshelves"), review: column("My Review"), id: column("Book Id") };
  if (at.title < 0 || at.shelf < 0) throw new Error("Este arquivo não parece uma exportação do Goodreads (faltam as colunas Title e Exclusive Shelf).");
  const owned = new Set(library.filter(book => !book.isDeleted).map(book => `${catalogKey(book.title)}|${catalogKey(book.author)}`));
  const ownedTitles = new Set(library.filter(book => !book.isDeleted).map(book => catalogKey(book.title)));
  const seen = new Set<string>();
  const out: GoodreadsCandidate[] = [];
  for (const values of rows) {
    const get = (index: number) => index >= 0 ? (values[index] ?? "").trim() : "";
    // Goodreads writes ISBNs as ="9788535902778"; keep only the digits and validate the check digit.
    const isbnText = (index: number) => get(index).replace(/^="?|"$/g, "");
    const title = get(at.title).replace(/\s+/g, " ").slice(0, 300);
    if (!title) continue;
    const author = get(at.author).replace(/\s+/g, " ").slice(0, 300);
    const shelf = get(at.shelf).toLowerCase();
    const shelves = get(at.shelves).split(",").map(name => name.trim()).filter(Boolean);
    const interrupted = shelves.some(name => /^(interrompido|abandoned|did-not-finish|dnf)$/i.test(name));
    const start = interrupted ? "interrupted" : SHELF_STARTS[shelf] ?? "want";
    const ratingValue = Number(get(at.rating));
    const pagesValue = Number(get(at.pages));
    const key = `${catalogKey(title)}|${catalogKey(author)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key, title, author,
      isbn13: normalizeIsbn(isbnText(at.isbn13)) ?? normalizeIsbn(isbnText(at.isbn)),
      goodreadsId: /^\d{1,12}$/.test(get(at.id)) ? get(at.id) : null,
      pages: Number.isInteger(pagesValue) && pagesValue > 0 && pagesValue < 100000 ? pagesValue : null,
      rating: Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null,
      review: get(at.review).replace(/<br\s*\/?>/gi, "\n").slice(0, 20000) || null,
      start,
      collections: [...new Set(shelves.filter(name => !EXCLUSIVE.has(name.toLowerCase()) && !/^(interrompido|abandoned|did-not-finish|dnf)$/i.test(name)))].slice(0, 20).map(name => name.slice(0, 120)),
      inLibrary: owned.has(key) || (!author && ownedTitles.has(catalogKey(title))),
    });
  }
  return out;
}

/** Item de catálogo mínimo para o livro sem arquivo: ISBN quando o CSV traz, senão o número do Goodreads; sem capa nem categoria inventadas. */
export function candidateCatalogItem(candidate: GoodreadsCandidate): CatalogBook {
  const id = candidate.isbn13 ? `isbn:${candidate.isbn13}` : candidate.goodreadsId ? `gr:${candidate.goodreadsId}` : `file:${candidate.key.replace(/[^\w.-]/g, "-").slice(0, 60)}`;
  return { id, source: "file", title: candidate.title, subtitle: null, authors: candidate.author ? [candidate.author] : [], firstPublishYear: null, languages: [],
    isbns: candidate.isbn13 ? [candidate.isbn13] : [], pages: candidate.pages, subjects: [], categories: [], coverUrl: null, sourceUrl: null };
}
