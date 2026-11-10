import { Book, MOCK_BOOKS } from "@/src/constants/mockBooks";

/**
 * Nome de exibição de um livro. Livros do acervo embutido são gravados com o nome do arquivo como título
 * ("sobre-a-vida-feliz"); a Biblioteca já mostrava o título do catálogo e o Reader mostrava o nome do arquivo.
 * Uma só regra para as duas telas. Não inventa dado: usa o catálogo embutido ou só troca separadores por espaços.
 */
export function normalizeBookTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const catalogByTitle = new Map(MOCK_BOOKS.map(book => [normalizeBookTitle(book.title), book]));
const catalogByFileName = new Map(MOCK_BOOKS.map(book => [normalizeBookTitle(book.fileUri.split(/[\\/]/).pop() ?? ""), book]));

/** Entrada do catálogo embutido para este livro (por título ou nome do arquivo), se houver. */
export function catalogBookFor(book: { title: string; fileName?: string | null }): Book | undefined {
  return catalogByTitle.get(normalizeBookTitle(book.title)) ?? (book.fileName ? catalogByFileName.get(normalizeBookTitle(book.fileName)) : undefined);
}

/** Título legível: catálogo embutido; senão o título salvo, trocando "-"/"_" por espaço quando ele é só um nome de arquivo. */
export function readableBookTitle(book: { title: string; fileName?: string | null }): string {
  const catalog = catalogBookFor(book);
  if (catalog) return catalog.title;
  const title = book.title.trim();
  if (!title || /\s/.test(title) || !/[-_]/.test(title)) return title;
  const spaced = title.replace(/\.(epub|pdf)$/i, "").replace(/[-_]+/g, " ").trim();
  return spaced ? spaced[0].toLocaleUpperCase("pt-BR") + spaced.slice(1) : title;
}
