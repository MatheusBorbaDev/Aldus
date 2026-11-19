import { throwIfAborted, withAbort } from "@/src/core/utils/cancellation";
import { CatalogBook, normalizeIsbn, parseCatalogBook } from "@/src/domain/catalog/catalogBook";

/**
 * Fontes abertas de metadados, trocáveis (decisão do dono em 18/11/2026: sem Google por enquanto; "o máximo de fontes que não vão
 * me gerar problemas"). Cada fonte cumpre o mesmo contrato e valida tudo o que recebe. Nenhuma envia dados da conta: só o texto
 * buscado ou o ISBN saem do aparelho.
 */
export interface MetadataSource {
  readonly name: string;
  search(query: string, signal?: AbortSignal): Promise<CatalogBook[]>;
}
export class CatalogUnavailableError extends Error {
  constructor(message = "O catálogo não respondeu agora. Confira a conexão e tente de novo.") { super(message); this.name = "CatalogUnavailableError"; }
}
type Fetch = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Espaça as chamadas para respeitar o limite da fonte (Open Library: 1 por segundo sem identificação). */
export class RequestSpacer {
  private next = 0;
  constructor(private readonly intervalMs: number, private readonly now = () => Date.now(), private readonly sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {}
  async wait(signal?: AbortSignal): Promise<void> {
    const at = Math.max(this.now(), this.next);
    this.next = at + this.intervalMs;
    const delay = at - this.now();
    if (delay > 0) await withAbort(this.sleep(delay), signal);
    throwIfAborted(signal);
  }
}

async function getJson(fetcher: Fetch, url: string, signal: AbortSignal | undefined, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await withAbort(fetcher(url, { headers, signal: controller.signal }), controller.signal);
    if (!response.ok) throw new CatalogUnavailableError(response.status === 429 || response.status === 403 ? "O catálogo recebeu muitas buscas agora. Aguarde um pouco e tente de novo." : undefined);
    return await withAbort(response.json(), controller.signal);
  } catch (error) {
    throwIfAborted(signal);
    if (error instanceof CatalogUnavailableError) throw error;
    throw new CatalogUnavailableError();
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

const OL_FIELDS = "key,title,subtitle,author_name,first_publish_year,language,isbn,number_of_pages_median,subject,cover_i";

/** Open Library: busca de obras. Capa só pelo número da capa (fora do limite por ISBN); crédito pela página da obra. */
export class OpenLibrarySource implements MetadataSource {
  readonly name = "openlibrary";
  constructor(private readonly fetcher: Fetch, private readonly spacer = new RequestSpacer(1000), private readonly headers: Record<string, string> = { Accept: "application/json" }) {}
  async search(query: string, signal?: AbortSignal): Promise<CatalogBook[]> {
    const isbn = normalizeIsbn(query);
    const params = new URLSearchParams(isbn ? { isbn, fields: OL_FIELDS, limit: "10" } : { q: query, fields: OL_FIELDS, limit: "20" });
    await this.spacer.wait(signal);
    const body = await getJson(this.fetcher, `https://openlibrary.org/search.json?${params}`, signal, this.headers, 15000) as { docs?: unknown };
    const docs = Array.isArray(body?.docs) ? body.docs : [];
    const books: CatalogBook[] = [];
    for (const doc of docs.slice(0, 20)) {
      const item = doc as Record<string, unknown>;
      const key = typeof item.key === "string" ? /^\/works\/(OL\d+W)$/.exec(item.key)?.[1] : undefined;
      if (!key) continue;
      const coverId = typeof item.cover_i === "number" && Number.isInteger(item.cover_i) && item.cover_i > 0 ? item.cover_i : null;
      const book = parseCatalogBook({
        id: `ol:${key}`, source: "openlibrary", title: item.title, subtitle: item.subtitle, authors: item.author_name,
        firstPublishYear: item.first_publish_year, languages: item.language,
        isbns: Array.isArray(item.isbn) ? item.isbn.slice(0, 40) : [], pages: item.number_of_pages_median,
        subjects: Array.isArray(item.subject) ? item.subject.slice(0, 30) : [],
        coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null, sourceUrl: `https://openlibrary.org/works/${key}`,
      });
      if (book) books.push(book);
    }
    return books;
  }
}

const GB_FIELDS = "items(id,volumeInfo(title,subtitle,authors,publishedDate,language,industryIdentifiers,pageCount,categories,imageLinks/thumbnail,description))";
const stripHtml = (value: unknown) => typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'") : value;

/**
 * Google Books (decisão do dono em 19/11/2026: "Google Books + Open Library", para ter as edições brasileiras). Só o texto buscado ou
 * o ISBN vão ao Google, com a chave pública do app; nenhum dado da conta. A capa vem do próprio Google pelo id do volume; o ano é o
 * desta edição (o Google não informa a primeira publicação).
 */
export class GoogleBooksSource implements MetadataSource {
  readonly name = "googlebooks";
  constructor(private readonly fetcher: Fetch, private readonly apiKey: string, private readonly headers: Record<string, string> = { Accept: "application/json" }) {}
  async search(query: string, signal?: AbortSignal): Promise<CatalogBook[]> {
    const isbn = normalizeIsbn(query);
    const params = new URLSearchParams({ q: isbn ? `isbn:${isbn}` : query, maxResults: "20", printType: "books", fields: GB_FIELDS, key: this.apiKey });
    const body = await getJson(this.fetcher, `https://www.googleapis.com/books/v1/volumes?${params}`, signal, this.headers, 15000) as { items?: unknown };
    const items = Array.isArray(body?.items) ? body.items : [];
    const books: CatalogBook[] = [];
    for (const raw of items.slice(0, 20)) {
      const item = raw as { id?: unknown; volumeInfo?: Record<string, unknown> };
      const id = typeof item.id === "string" && /^[\w-]{6,20}$/.test(item.id) ? item.id : null;
      const info = item.volumeInfo;
      if (!id || !info) continue;
      const year = typeof info.publishedDate === "string" ? Number(/^(\d{4})/.exec(info.publishedDate)?.[1]) : NaN;
      const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers as Array<{ identifier?: unknown }> : [];
      const categories = Array.isArray(info.categories) ? info.categories.flatMap(value => typeof value === "string" ? value.split(/\s*\/\s*/) : []) : [];
      const thumbnail = (info.imageLinks as { thumbnail?: unknown } | undefined)?.thumbnail;
      const book = parseCatalogBook({
        id: `gb:${id}`, source: "googlebooks", title: info.title, subtitle: info.subtitle, authors: info.authors,
        firstPublishYear: null, editionYear: Number.isFinite(year) ? year : null,
        languages: typeof info.language === "string" ? [info.language] : [],
        isbns: identifiers.map(entry => entry?.identifier).filter((value): value is string => typeof value === "string"),
        pages: info.pageCount, subjects: categories.slice(0, 30), description: stripHtml(info.description),
        coverUrl: typeof thumbnail === "string" ? `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&source=gbs_api` : null,
        sourceUrl: `https://books.google.com/books?id=${id}`,
      });
      if (book) books.push(book);
    }
    return books;
  }
}

/**
 * Wikidata (CC0): gêneros de uma obra pelo ISBN, para enriquecer categorias e recomendações na ficha do livro. Não entra na busca
 * por texto, para não multiplicar chamadas.
 */
export class WikidataGenres {
  constructor(private readonly fetcher: Fetch, private readonly spacer = new RequestSpacer(1000)) {}
  async byIsbn(isbn13: string, signal?: AbortSignal): Promise<string[]> {
    const isbn = normalizeIsbn(isbn13);
    if (!isbn) return [];
    const hyphenless = isbn;
    const query = `SELECT DISTINCT ?genreLabel WHERE { { ?edition wdt:P212 ?isbn } UNION { ?edition wdt:P957 ?isbn } FILTER(REPLACE(?isbn, "-", "") = "${hyphenless}") ?edition (wdt:P629?) ?work . ?work wdt:P136 ?genre . SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". } } LIMIT 20`;
    await this.spacer.wait(signal);
    const body = await getJson(this.fetcher, `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, signal, { Accept: "application/sparql-results+json" }, 20000) as { results?: { bindings?: unknown } };
    const bindings = Array.isArray(body?.results?.bindings) ? body.results.bindings : [];
    return [...new Set(bindings.map(binding => (binding as { genreLabel?: { value?: unknown } })?.genreLabel?.value)
      .filter((label): label is string => typeof label === "string" && !!label.trim() && !/^Q\d+$/.test(label)).map(label => label.trim().slice(0, 120)))].slice(0, 20);
  }
}
