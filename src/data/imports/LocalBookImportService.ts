import * as FileSystem from "expo-file-system/legacy";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { Platform } from "react-native";
import { throwIfAborted, withAbort } from "@/src/core/utils/cancellation";
import { EpubFileImporter } from "@/src/data/epub/EpubFileImporter";
import { PdfFileImporter } from "@/src/data/local/PdfFileImporter";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookImportFormat, BookImportPhaseUpdate } from "@/src/domain/types/bookImport";

export interface PickedBookFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  file?: Blob;
}

interface ImportFileSystem {
  documentDirectory: string | null;
  makeDirectoryAsync(path: string, options: { intermediates: boolean }): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
  moveAsync(options: { from: string; to: string }): Promise<void>;
  deleteAsync(path: string, options: { idempotent: boolean }): Promise<void>;
  readAsStringAsync(path: string, options: unknown): Promise<string>;
}

export interface LocalBookImportOptions {
  operationId: string;
  signal: AbortSignal;
  onPhase: (update: BookImportPhaseUpdate) => void;
}

export class LocalBookImportService {
  constructor(
    private readonly epubImporter: EpubFileImporter,
    private readonly pdfImporter: PdfFileImporter,
    private readonly platform: string = Platform.OS,
    private readonly files: ImportFileSystem = FileSystem as unknown as ImportFileSystem
  ) {}

  async import(file: PickedBookFile, options: LocalBookImportOptions): Promise<LibraryBook> {
    const accountRun = libraryAccountScope.capture();
    throwIfAborted(options.signal);
    options.onPhase({ phase: "preparing", cancellable: true, fileSize: file.size ?? undefined });
    // Native "Abrir com" files arrive as content:// with no type or extension; their first bytes are read after the copy.
    const declared = await this.detectFormat(file, options.signal);
    const size = file.size ?? undefined;

    if (this.platform === "web") {
      const format = declared ?? unreadable();
      accountRun.check();
      return format === "pdf"
        ? this.pdfImporter.importFromUri(file.uri, normalizedName(file.name, format), undefined, file.file, {
            signal: options.signal,
            onPhase: update => options.onPhase({ ...update, format, fileSize: update.fileSize ?? size }),
          })
        : this.epubImporter.importFromUri(file.uri, normalizedName(file.name, format), file.file, undefined, {
            signal: options.signal,
            onPhase: update => options.onPhase({ ...update, format, fileSize: update.fileSize ?? size }),
          });
    }

    const root = this.files.documentDirectory;
    if (!root) throw new Error("O armazenamento local não está disponível neste aparelho.");
    const tempDirectory = `${root}books/temp/`;
    const importedDirectory = `${root}books/imported/`;
    const tempUri = `${tempDirectory}local-${safeFileName(options.operationId)}-incoming`;
    let importedUri = `${importedDirectory}local-${safeFileName(options.operationId)}-incoming`;

    await withAbort(Promise.all([
      this.files.makeDirectoryAsync(tempDirectory, { intermediates: true }),
      this.files.makeDirectoryAsync(importedDirectory, { intermediates: true }),
    ]).then(() => undefined), options.signal);

    try {
      options.onPhase({ phase: "copying", cancellable: true, ...(declared ? { format: declared } : {}), fileSize: size });
      const copy = this.files.copyAsync({ from: file.uri, to: tempUri });
      try {
        await withAbort(copy, options.signal);
      } catch (error) {
        if (options.signal.aborted) void copy.then(() => this.cleanupStagedFiles(tempUri, importedUri)).catch(() => undefined);
        throw error;
      }
      throwIfAborted(options.signal);
      const format = declared ?? formatFromSignature(await this.readSignature(tempUri, options.signal));
      const safeName = safeFileName(normalizedName(file.name, format));
      importedUri = `${importedDirectory}local-${safeFileName(options.operationId)}-${safeName}`;
      const move = this.files.moveAsync({ from: tempUri, to: importedUri });
      try {
        await withAbort(move, options.signal);
      } catch (error) {
        if (options.signal.aborted) void move.then(() => this.cleanupStagedFiles(tempUri, importedUri)).catch(() => undefined);
        throw error;
      }
      throwIfAborted(options.signal);

      accountRun.check();
      return format === "pdf"
        ? await this.pdfImporter.importFromUri(importedUri, safeName, undefined, undefined, {
            signal: options.signal,
            onPhase: update => options.onPhase({ ...update, format, fileSize: update.fileSize ?? size }),
          })
        : await this.epubImporter.importFromUri(importedUri, safeName, undefined, undefined, {
            signal: options.signal,
            onPhase: update => options.onPhase({ ...update, format, fileSize: update.fileSize ?? size }),
          });
    } catch (error) {
      void this.cleanupStagedFiles(tempUri, importedUri);
      throw error;
    }
  }

  private async cleanupStagedFiles(tempUri: string, importedUri: string): Promise<void> {
    await Promise.all([
      this.files.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined),
      this.files.deleteAsync(importedUri, { idempotent: true }).catch(() => undefined),
    ]);
  }

  private async detectFormat(file: PickedBookFile, signal: AbortSignal): Promise<BookImportFormat | null> {
    const mimeType = file.mimeType?.toLowerCase() ?? "";
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType === "application/epub+zip" || mimeType === "application/epub") return "epub";
    if (/\.pdf$/i.test(file.name)) return "pdf";
    if (/\.epub$/i.test(file.name)) return "epub";

    if (file.file) {
      const header = new Uint8Array(await withAbort(file.file.slice(0, 5).arrayBuffer(), signal));
      return formatFromSignature(String.fromCharCode(...header));
    }
    // A content:// document often cannot be read partially before it is copied; the copy is checked instead.
    if (/^content:/i.test(file.uri)) return null;
    return formatFromSignature(await this.readSignature(file.uri, signal));
  }

  private async readSignature(uri: string, signal: AbortSignal): Promise<string> {
    try {
      return atob(await withAbort(this.files.readAsStringAsync(uri, { encoding: "base64", position: 0, length: 5 }), signal));
    } catch (error) {
      if (signal.aborted) throw error;
      unreadable();
    }
  }
}

function unreadable(): never {
  throw new Error("Não foi possível identificar o formato do arquivo selecionado.");
}

function formatFromSignature(signature: string): BookImportFormat {
  if (signature.startsWith("%PDF-")) return "pdf";
  if (signature.startsWith("PK")) return "epub";
  throw new Error("Formato não suportado. Selecione um arquivo EPUB ou PDF válido.");
}

function safeFileName(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return safe || "livro";
}

function normalizedName(fileName: string, format: BookImportFormat): string {
  return /\.(?:epub|pdf)$/i.test(fileName) ? fileName : `${fileName}.${format}`;
}
