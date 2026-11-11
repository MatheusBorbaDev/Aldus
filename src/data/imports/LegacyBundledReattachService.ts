import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { withAbort, throwIfAborted } from "@/src/core/utils/cancellation";
import { findBundledAsset, isLegacyBundledAsset, isLegacyBundledBook } from "@/src/data/library/BundledBookIdentity";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookRepository } from "@/src/domain/repositories/BookRepository";
import { PickedBookFile } from "./LocalBookImportService";

interface WebFiles {
  save(bookId: string, fileName: string, file: Blob): Promise<void>;
  delete(bookId: string): Promise<void>;
}

interface ReattachFileSystem {
  documentDirectory: string | null;
  makeDirectoryAsync(path: string, options: { intermediates: boolean }): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
  deleteAsync(path: string, options: { idempotent: boolean }): Promise<void>;
}

/**
 * Acervo, etapa 2 (decisão do usuário em 11/11/2026: "reanexar ao importar"). Os 33 títulos protegidos saíram do pacote; o
 * registro da conta (mesmo ID, progresso, grifos, notas) continua. Quando a pessoa importa o MESMO arquivo (SHA-256 igual ao
 * do acervo legado), ele vira a cópia própria desse registro: grava a cópia local, troca `filePath`, zera `bundledAssetId` e
 * fixa `fileHash` num único `save`; o Sync privado envia a cópia ao bucket da conta como qualquer importação. Nada é criado
 * para outras contas e nada é distribuído: só reanexa arquivos que a própria pessoa forneceu.
 */
export class LegacyBundledReattachService {
  constructor(
    private readonly books: Pick<BookRepository, "listActive" | "listOwned" | "findById" | "save">,
    private readonly webFiles?: WebFiles,
    private readonly files: ReattachFileSystem = FileSystem as unknown as ReattachFileSystem,
    private readonly platform: string = Platform.OS
  ) {}

  /** O livro legado desta conta cujo arquivo do acervo tem este hash e ainda não tem cópia própria; senão null. */
  async find(hash: string | null): Promise<LibraryBook | null> {
    if (!hash || !libraryAccountScope.userId) return null;
    const run = libraryAccountScope.capture();
    const books = await (this.books.listOwned?.() ?? this.books.listActive()); run.check();
    return books.find(book => {
      if (book.isDeleted || !isLegacyBundledBook(book)) return false;
      const asset = findBundledAsset(book.bundledAssetId ?? book.id);
      return !!asset && asset.hash === hash && isLegacyBundledAsset(asset.id);
    }) ?? null;
  }

  async reattach(target: LibraryBook, file: PickedBookFile, hash: string, signal: AbortSignal): Promise<LibraryBook> {
    const run = libraryAccountScope.capture();
    if (!run.userId) throw new Error("Entre na sua conta.");
    const asset = findBundledAsset(target.bundledAssetId ?? target.id);
    if (!asset || asset.hash !== hash) throw new Error("Este arquivo não corresponde ao livro da conta.");
    const pdf = asset.format === "pdf";
    let filePath: string;
    let savedWeb = false, copiedUri: string | null = null, committed = false;
    try {
      if (this.platform === "web") {
        if (!this.webFiles || !file.file) throw new Error("O armazenamento local não está disponível neste navegador.");
        await withAbort(this.webFiles.save(target.id, asset.fileName, file.file), signal); savedWeb = true;
        filePath = `${pdf ? "web-pdf" : "web-epub"}://${target.id}`;
      } else {
        const root = this.files.documentDirectory;
        if (!root) throw new Error("O armazenamento local não está disponível neste aparelho.");
        const directory = `${root}books/imported/`;
        copiedUri = `${directory}acervo-${target.id.replace(/[^a-zA-Z0-9-]/g, "_")}.${pdf ? "pdf" : "epub"}`;
        await withAbort(this.files.makeDirectoryAsync(directory, { intermediates: true }), signal);
        await withAbort(this.files.copyAsync({ from: file.uri, to: copiedUri }), signal);
        filePath = copiedUri;
      }
      throwIfAborted(signal); run.check();
      const current = await this.books.findById(target.id); run.check();
      if (!current || current.isDeleted || !isLegacyBundledBook(current)) throw new Error("O livro mudou durante a restauração. Tente de novo.");
      const restored: LibraryBook = { ...current, filePath, bundledAssetId: undefined, fileHash: hash, fileSize: asset.size, remotePath: null, importComplete: true };
      await this.books.save(restored); committed = true;
      run.check();
      return restored;
    } catch (error) {
      // Depois do save a cópia é do registro: nunca apagar o arquivo para o qual ele aponta.
      if (committed) throw error;
      if (savedWeb && this.webFiles) await this.webFiles.delete(target.id).catch(() => undefined);
      if (copiedUri) await this.files.deleteAsync(copiedUri, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  }
}
