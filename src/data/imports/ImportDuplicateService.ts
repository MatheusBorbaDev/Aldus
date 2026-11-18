import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { withAbort } from "@/src/core/utils/cancellation";
import { hashBookFile, hashLocalBookFile, MAX_PRIVATE_BOOK_SIZE, NativeFileHasher } from "@/src/data/library/BookFileIntegrity";
import { nativeFileHasher } from "@/src/data/library/nativeFileHasher";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookRepository } from "@/src/domain/repositories/BookRepository";
import { findImportedDuplicate, parseImportHashIndex, rememberImportHash, serializeImportHashIndex } from "@/src/domain/import/importDuplicates";
import { PickedBookFile } from "./LocalBookImportService";

/** Um índice por conta: A e B nunca veem os hashes uma da outra. */
export const IMPORT_HASH_KEY_PREFIX = "@aldus/import-hashes.v1:";
export const importHashKey = (userId: string) => IMPORT_HASH_KEY_PREFIX + encodeURIComponent(userId);

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface HashFileSystem {
  getInfoAsync(uri: string): Promise<{ exists: boolean; isDirectory?: boolean; size?: number }>;
  readAsStringAsync(uri: string, options: { encoding: "base64"; position: number; length: number }): Promise<string>;
}

export interface ImportDuplicateCheck {
  /** null quando não foi possível calcular (sem conta, arquivo vazio/maior que 512 MiB ou ilegível): importa sem aviso. */
  hash: string | null;
  existing: LibraryBook | null;
  userId: string | null;
}

/**
 * Aviso de duplicado na importação local (Fase 1, item 3). Calcula o SHA-256 do arquivo escolhido antes de importar
 * e consulta o índice local da conta. Falha no cálculo nunca impede a importação; cancelamento sim.
 */
export class ImportDuplicateService {
  constructor(
    private readonly books: Pick<BookRepository, "findById">,
    private readonly storage: KeyValueStorage = AsyncStorage,
    private readonly files: HashFileSystem = FileSystem as unknown as HashFileSystem,
    private readonly platform: string = Platform.OS,
    private readonly native: NativeFileHasher | null = nativeFileHasher
  ) {}

  async check(file: PickedBookFile, signal: AbortSignal): Promise<ImportDuplicateCheck> {
    const run = libraryAccountScope.capture();
    const none: ImportDuplicateCheck = { hash: null, existing: null, userId: run.userId };
    if (!run.userId) return none;
    let hash: string | null;
    try {
      hash = await this.hash(file, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      return none;
    }
    if (!hash) return none;
    run.check();
    const index = parseImportHashIndex(await this.storage.getItem(importHashKey(run.userId)).catch(() => null));
    const existing = await findImportedDuplicate(index, hash, id => this.books.findById(id));
    run.check();
    return { hash, existing, userId: run.userId };
  }

  /** Grava o hash do livro recém-importado. Ignora se a conta mudou; erro de gravação só perde um aviso futuro. */
  async remember(check: ImportDuplicateCheck, bookId: string): Promise<void> {
    if (!check.hash || !check.userId || libraryAccountScope.userId !== check.userId) return;
    const key = importHashKey(check.userId);
    const index = parseImportHashIndex(await this.storage.getItem(key).catch(() => null));
    await this.storage.setItem(key, serializeImportHashIndex(rememberImportHash(index, check.hash, bookId)));
  }

  private async hash(file: PickedBookFile, signal: AbortSignal): Promise<string | null> {
    const blob = file.file;
    if (blob) {
      if (blob.size <= 0 || blob.size > MAX_PRIVATE_BOOK_SIZE) return null;
      return hashBookFile(blob.size, async (position, length) => new Uint8Array(await withAbort(blob.slice(position, position + length).arrayBuffer(), signal)), signal);
    }
    if (this.platform === "web") return null;
    let size = file.size ?? null;
    if (!size) {
      const info = await withAbort(this.files.getInfoAsync(file.uri), signal);
      size = info.exists && !info.isDirectory ? info.size ?? null : null;
    }
    if (!size || size <= 0 || size > MAX_PRIVATE_BOOK_SIZE) return null;
    return hashLocalBookFile(file.uri, size, (position, length) => withAbort(this.files.readAsStringAsync(file.uri, { encoding: "base64", position, length }), signal), signal, this.native);
  }
}
