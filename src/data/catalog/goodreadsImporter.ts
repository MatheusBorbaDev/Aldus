import { createRecordBook, recordBookOrganization, RecordBookFormat } from "@/src/domain/catalog/recordBook";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { candidateCatalogItem, GoodreadsCandidate } from "@/src/domain/library/goodreadsImport";
import { BookOrganization, LibraryOrganizationRepository } from "@/src/domain/types/libraryOrganization";

/**
 * Grava os livros escolhidos na revisão da importação do Goodreads (18/11/2026), um por vez. Se algo falhar no meio, os já gravados
 * ficam e a mensagem diz quantos entraram; nada é desfeito em silêncio nem repetido.
 */
export async function importGoodreadsCandidates(
  deps: { books: { save(book: LibraryBook): Promise<void> }; organization: Pick<LibraryOrganizationRepository, "save">; newId: () => string },
  candidates: GoodreadsCandidate[], format: RecordBookFormat, onProgress?: (done: number) => void, now = Date.now(),
): Promise<number> {
  let done = 0;
  try {
    for (const candidate of candidates) {
      const book = createRecordBook({ catalog: candidateCatalogItem(candidate), format, id: deps.newId(), now });
      const base = recordBookOrganization(book.id, candidate.start === "interrupted" ? "want" : candidate.start, now);
      const organization: BookOrganization = {
        ...base, wantToRead: candidate.start === "want" ? true : undefined,
        readingStatus: candidate.start === "interrupted" ? "interrupted" : base.readingStatus,
        collections: candidate.collections, rating: candidate.rating ?? undefined, review: candidate.review ?? undefined,
      };
      await deps.books.save(book);
      await deps.organization.save(organization);
      done++;
      onProgress?.(done);
    }
  } catch (failure) {
    const reason = failure instanceof Error ? failure.message : "erro desconhecido";
    throw new Error(done ? `${done === 1 ? "1 livro entrou" : `${done} livros entraram`}; os demais não puderam ser gravados (${reason}).` : `Nenhum livro pôde ser gravado (${reason}).`);
  }
  return done;
}
