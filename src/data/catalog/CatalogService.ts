import { throwIfAborted } from "@/src/core/utils/cancellation";
import { CatalogBook, catalogKey, mergeCatalogBooks, parseCatalogBook } from "@/src/domain/catalog/catalogBook";
import type { LibraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { CatalogUnavailableError, MetadataSource } from "./catalogSources";

export interface CatalogStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; }
interface CacheEntry { query: string; savedAt: number; books: unknown[] }

const MAX_ENTRIES = 100, TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Cache derivado, por conta (as buscas revelam interesses de leitura): ilegível vale como vazio, nunca bloqueia a busca. */
export const catalogCacheKey = (userId: string | null) => `@aldus/catalog-cache.v1:${userId ?? "device"}`;

/**
 * Busca no catálogo de metadados: cache por conta no aparelho (7 dias, 100 buscas), depois as fontes, uma de cada vez, juntando
 * resultados repetidos. Cancelável; a conta capturada no início vale até o fim (troca de conta descarta o resultado).
 */
export class CatalogService {
  private pending: Promise<void> = Promise.resolve();
  constructor(private readonly sources: MetadataSource[], private readonly storage: CatalogStorage, private readonly scope: LibraryAccountScope, private readonly now = () => Date.now()) {}

  async search(rawQuery: string, signal?: AbortSignal): Promise<CatalogBook[]> {
    const query = rawQuery.replace(/\s+/g, " ").trim();
    if (catalogKey(query).length < 2) return [];
    const account = this.scope.capture();
    const key = catalogKey(query);
    const cached = await this.readCache(account.userId);
    account.check(); throwIfAborted(signal);
    const hit = cached.find(entry => entry.query === key && this.now() - entry.savedAt < TTL_MS);
    if (hit) return hit.books.map(parseCatalogBook).filter((book): book is CatalogBook => !!book);
    const found: CatalogBook[] = [];
    let failure: unknown = null, answered = false;
    for (const source of this.sources) {
      try { found.push(...await source.search(query, signal)); answered = true; }
      catch (error) { throwIfAborted(signal); failure = error; }
    }
    account.check(); throwIfAborted(signal);
    if (!answered) throw failure instanceof CatalogUnavailableError ? failure : new CatalogUnavailableError();
    const books = mergeCatalogBooks(found);
    await this.writeCache(account, key, books);
    return books;
  }

  /** Livros já baixados por esta conta neste aparelho (fileiras e buscas ainda válidas). Sem rede: base do "Para você". */
  async cachedBooks(): Promise<CatalogBook[]> {
    const account = this.scope.capture();
    const entries = await this.readCache(account.userId);
    account.check();
    return mergeCatalogBooks(entries.filter(entry => this.now() - entry.savedAt < TTL_MS)
      .flatMap(entry => entry.books.map(parseCatalogBook).filter((book): book is CatalogBook => !!book)));
  }

  private async readCache(userId: string | null): Promise<CacheEntry[]> {
    try {
      const raw = await this.storage.getItem(catalogCacheKey(userId));
      const value = raw ? JSON.parse(raw) as unknown : [];
      return Array.isArray(value) ? value.filter((entry): entry is CacheEntry => !!entry && typeof entry.query === "string" && typeof entry.savedAt === "number" && Array.isArray(entry.books)) : [];
    } catch { return []; }
  }
  private writeCache(account: ReturnType<LibraryAccountScope["capture"]>, query: string, books: CatalogBook[]): Promise<void> {
    // Writes are queued so two searches never overwrite each other's entry; a failed write does not fail the search.
    const run = this.pending.catch(() => undefined).then(async () => {
      account.check();
      const entries = (await this.readCache(account.userId)).filter(entry => entry.query !== query && this.now() - entry.savedAt < TTL_MS);
      entries.unshift({ query, savedAt: this.now(), books });
      account.check();
      await this.storage.setItem(catalogCacheKey(account.userId), JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    }).catch(() => undefined);
    this.pending = run;
    return run;
  }
}
