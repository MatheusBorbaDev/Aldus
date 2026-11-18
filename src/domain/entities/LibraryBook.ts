export interface LibraryBook {
  /**
   * "record": livro do catálogo sem arquivo (físico, de outra loja ou audiolivro), adicionado pela pessoa (18/11/2026). Não abre
   * no leitor, não tem arquivo nem envio à nuvem, e fica só no aparelho até o servidor aceitar esse formato. Ausente = livro com arquivo.
   */
  kind?: "record";
  /** Item do catálogo de metadados de onde o livro veio (ex.: `ol:OL45883W`). */
  catalogId?: string | null;
  recordFormat?: "physical" | "ebook" | "audiobook";
  /** Missing/null means preserved legacy local data, never silently claimed. */
  ownerUserId?: string | null;
  bundledAssetId?: string;
  importComplete?: boolean;
  /** Private, immutable object; never a public URL or a device URI. */
  remotePath?: string | null;
  localEvictionPath?: string;
  remoteCleanupDone?: boolean;
  syncUnjournaled?: boolean;
  id: string;
  title: string;
  author: string;
  fileName: string;
  filePath: string;
  fileHash: string | null;
  mimeType: string;
  fileSize: number;
  coverImagePath: string | null;
  totalChapters: number;
  totalWords: number;
  addedDate: number;
  lastOpenedDate: number | null;
  /**
   * Derivado na leitura: `updatedAt` do progresso de leitura já persistido (última leitura real).
   * Nunca é gravado de volta nem sincronizado; ausente/null quando não há progresso salvo.
   */
  lastReadAt?: number | null;
  isDeleted: boolean;
  progress: number;
}

export interface StoredChapter {
  id: string;
  bookId: string;
  chapterIndex: number;
  title: string;
  startCfi: string | null;
  endCfi: string | null;
  characterCount: number;
  html: string;
}

export const RECORD_BOOK_MIME = "application/x.aldus-record";
export const RECORD_BOOK_PREFIX = "record-";
/** Livro sem arquivo: marcação e identificador próprios, para nenhum caminho de arquivo tratá-lo como EPUB/PDF. */
export function isRecordBook(book: Pick<LibraryBook, "id" | "kind"> | null | undefined): boolean {
  return !!book && book.kind === "record" && book.id.startsWith(RECORD_BOOK_PREFIX);
}
/** Organização de um livro sem arquivo também fica só no aparelho enquanto o servidor não aceitar o formato. */
export function isRecordBookId(bookId: string): boolean { return bookId.startsWith(RECORD_BOOK_PREFIX); }
/** Liga quando a migration 20261118120000_record_books for aplicada no servidor (autorização própria do dono). */
export const RECORD_BOOKS_SYNC_ENABLED = false;
