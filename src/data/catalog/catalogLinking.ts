import { CatalogBook } from "@/src/domain/catalog/catalogBook";
import { catalogLinkFields, linkKey, mergeLinkedOrganization } from "@/src/domain/catalog/catalogLink";
import { isRecordBook, LibraryBook } from "@/src/domain/entities/LibraryBook";
import { LibraryOrganizationRepository } from "@/src/domain/types/libraryOrganization";

interface LinkBooks { findById(id: string): Promise<LibraryBook | null>; save(book: LibraryBook): Promise<void>; softDelete(id: string): Promise<void> }
interface KeyValue { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }

/**
 * Junta um arquivo ao livro que a pessoa tinha guardado sem arquivo (A5, 18/11/2026): o arquivo recebe a ligação ao catálogo e a
 * organização dos dois; o livro sem arquivo sai da biblioteca. Só roda depois de a pessoa tocar em "Juntar".
 */
export async function linkFileToRecord(deps: { books: LinkBooks; organization: LibraryOrganizationRepository }, fileId: string, recordId: string, now = Date.now()): Promise<LibraryBook> {
  const [file, record] = await Promise.all([deps.books.findById(fileId), deps.books.findById(recordId)]);
  if (!file || file.isDeleted || isRecordBook(file)) throw new Error("O arquivo não está mais na sua biblioteca.");
  if (!record || record.isDeleted || !isRecordBook(record)) throw new Error("O livro guardado sem arquivo não está mais na sua biblioteca.");
  const records = await deps.organization.list();
  const linked: LibraryBook = { ...file, catalogId: record.catalogId ?? null, catalogCategories: record.catalogCategories ?? [], catalogPages: record.catalogPages ?? null };
  await deps.organization.save(mergeLinkedOrganization(fileId, records[fileId], records[recordId], now));
  await deps.books.save(linked);
  await deps.books.softDelete(recordId);
  return linked;
}

/** Liga um arquivo a um item escolhido no catálogo ("Ligar ao catálogo" no menu do livro). */
export async function linkFileToCatalog(books: LinkBooks, fileId: string, item: CatalogBook): Promise<LibraryBook> {
  const file = await books.findById(fileId);
  if (!file || file.isDeleted || isRecordBook(file)) throw new Error("O arquivo não está mais na sua biblioteca.");
  const linked = { ...file, ...catalogLinkFields(item) };
  await books.save(linked);
  return linked;
}

/** Pares que a pessoa respondeu "Manter separados", por conta, neste aparelho. Ilegível vale como vazio. */
export const catalogLinkDismissedKey = (userId: string) => `@aldus/catalog-link-dismissed.v1:${encodeURIComponent(userId)}`;
export async function readDismissedLinks(storage: KeyValue, userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  try { const value = JSON.parse(await storage.getItem(catalogLinkDismissedKey(userId)) ?? "[]"); return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-500) : []); }
  catch { return new Set(); }
}
export async function dismissLink(storage: KeyValue, userId: string, fileId: string, recordId: string): Promise<void> {
  const current = await readDismissedLinks(storage, userId);
  current.add(linkKey(fileId, recordId));
  await storage.setItem(catalogLinkDismissedKey(userId), JSON.stringify([...current].slice(-500)));
}
