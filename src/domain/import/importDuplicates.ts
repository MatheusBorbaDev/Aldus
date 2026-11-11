import { LibraryBook } from "@/src/domain/entities/LibraryBook";

/**
 * Índice local "SHA-256 do arquivo importado → livros" (Fase 1, aviso de duplicado). Serve só para avisar antes de
 * importar de novo o mesmo arquivo; não junta livros, não muda o UUID de cada importação e não toca `fileHash`
 * (esse campo pertence ao Sync/envio privado). É um cache derivado: se estiver ilegível, vale como vazio e o pior
 * caso é não avisar. Livros importados antes desta versão não estão no índice e não geram aviso.
 */
export interface ImportHashIndex {
  version: 1;
  /** hash → ids de livros, do mais antigo ao mais novo. */
  entries: Record<string, string[]>;
}

export const MAX_BOOKS_PER_IMPORT_HASH = 20;
export const MAX_IMPORT_HASHES = 5000;

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function emptyImportHashIndex(): ImportHashIndex {
  return { version: 1, entries: {} };
}

export function parseImportHashIndex(raw: string | null | undefined): ImportHashIndex {
  if (!raw) return emptyImportHashIndex();
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; entries?: unknown };
    if (parsed?.version !== 1 || !parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) return emptyImportHashIndex();
    const entries: Record<string, string[]> = Object.create(null);
    for (const [hash, ids] of Object.entries(parsed.entries as Record<string, unknown>)) {
      if (!isSha256Hex(hash) || !Array.isArray(ids)) continue;
      const valid = ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200);
      if (valid.length) entries[hash] = [...new Set(valid)].slice(-MAX_BOOKS_PER_IMPORT_HASH);
    }
    return { version: 1, entries };
  } catch {
    return emptyImportHashIndex();
  }
}

export function serializeImportHashIndex(index: ImportHashIndex): string {
  return JSON.stringify({ version: 1, entries: index.entries });
}

/** Acrescenta o livro ao hash; o mais recente fica no fim. Limita ids por hash e o total de hashes (sai o mais antigo). */
export function rememberImportHash(index: ImportHashIndex, hash: string, bookId: string): ImportHashIndex {
  if (!isSha256Hex(hash) || !bookId) return index;
  const entries: Record<string, string[]> = Object.create(null);
  for (const [key, ids] of Object.entries(index.entries)) if (key !== hash) entries[key] = ids;
  entries[hash] = [...(index.entries[hash] ?? []).filter(id => id !== bookId), bookId].slice(-MAX_BOOKS_PER_IMPORT_HASH);
  const keys = Object.keys(entries);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMPORT_HASHES))) delete entries[key];
  return { version: 1, entries };
}

/** O livro mais recente com esse hash que ainda está na biblioteca (não excluído), ou null. */
export async function findImportedDuplicate(index: ImportHashIndex, hash: string, load: (bookId: string) => Promise<LibraryBook | null>): Promise<LibraryBook | null> {
  if (!isSha256Hex(hash)) return null;
  const ids = index.entries[hash] ?? [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const book = await load(ids[i]).catch(() => null);
    if (book && !book.isDeleted) return book;
  }
  return null;
}
