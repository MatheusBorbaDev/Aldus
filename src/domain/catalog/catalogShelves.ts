import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { OrganizationRecords } from "@/src/domain/types/libraryOrganization";
import { ALDUS_CATEGORIES, AldusCategory, CatalogBook } from "./catalogBook";

/**
 * Vitrine do catálogo (fase 4, 18/11/2026). Cada categoria do Aldus vira uma busca por assunto no Open Library. As fileiras
 * iniciais são as mesmas para todo mundo e as outras só carregam quando a pessoa toca nelas: nada da biblioteca decide o que é
 * pedido à fonte (a política aprovada diz que nenhum dado da biblioteca sai do aparelho). "Para você" só reordena, no aparelho,
 * livros que já foram baixados.
 */
export const CATEGORY_QUERIES: Record<AldusCategory, string> = {
  romance: 'subject:"love stories"',
  classicos: 'subject:"classic literature"',
  "literatura-brasileira": 'subject:"brazilian fiction"',
  fantasia: "subject:fantasy",
  "ficcao-cientifica": 'subject:"science fiction"',
  "misterio-suspense": 'subject:"detective and mystery stories"',
  terror: "subject:horror",
  poesia: "subject:poetry",
  contos: 'subject:"short stories"',
  teatro: "subject:drama",
  infantojuvenil: 'subject:"juvenile fiction"',
  quadrinhos: 'subject:"comic books, strips, etc"',
  biografia: "subject:biography",
  historia: "subject:history",
  filosofia: "subject:philosophy",
  ciencia: "subject:science",
  sociedade: 'subject:"political science"',
  religiao: "subject:religion",
  "desenvolvimento-pessoal": 'subject:"self-help"',
  negocios: "subject:economics",
  estudo: 'subject:"study and teaching"',
};

/** Fileiras que abrem com a vitrine; iguais para todos. As demais aparecem como atalhos. */
export const INITIAL_SHELVES: readonly AldusCategory[] = ["classicos", "literatura-brasileira", "romance", "fantasia", "ficcao-cientifica", "misterio-suspense"];
export const MORE_SHELVES: readonly AldusCategory[] = (Object.keys(ALDUS_CATEGORIES) as AldusCategory[]).filter(key => !INITIAL_SHELVES.includes(key));

export function isAldusCategory(value: unknown): value is AldusCategory {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ALDUS_CATEGORIES, value);
}

/**
 * Peso de cada categoria na estante, calculado no aparelho a partir dos livros que vieram do catálogo (ou foram ligados a ele).
 * Lido, lendo, favorito e "Quero ler" pesam mais; "interrompido" não pesa. Nada disso é mostrado como número.
 */
export function libraryAffinity(books: LibraryBook[], organization: OrganizationRecords): Map<AldusCategory, number> {
  const affinity = new Map<AldusCategory, number>();
  for (const book of books) {
    if (book.isDeleted) continue;
    const record = organization[book.id];
    if (record?.readingStatus === "interrupted") continue;
    const weight = 1 + (record?.readingStatus === "completed" || record?.readingStatus === "reading" ? 1 : 0) + (record?.favorite ? 1 : 0) + (record?.wantToRead ? 1 : 0);
    for (const category of new Set(book.catalogCategories ?? [])) if (isAldusCategory(category)) affinity.set(category, (affinity.get(category) ?? 0) + weight);
  }
  return affinity;
}

export interface Recommendation { book: CatalogBook; because: AldusCategory }

/**
 * "Para você": livros já baixados (fileiras e buscas recentes deste aparelho) que combinam com as categorias da estante, sem os
 * que a pessoa já tem. Sem afinidade, nenhuma recomendação (nunca uma lista inventada).
 */
export function recommendFor(candidates: CatalogBook[], affinity: Map<AldusCategory, number>, ownedCatalogIds: ReadonlySet<string>, limit = 12): Recommendation[] {
  const seen = new Set<string>(), scored: Array<{ book: CatalogBook; score: number; because: AldusCategory; order: number }> = [];
  candidates.forEach((book, order) => {
    if (seen.has(book.id) || ownedCatalogIds.has(book.id)) return;
    seen.add(book.id);
    let score = 0, because: AldusCategory | null = null, best = 0;
    for (const category of book.categories) {
      const weight = affinity.get(category) ?? 0;
      score += weight;
      if (weight > best) { best = weight; because = category; }
    }
    if (score > 0 && because) scored.push({ book, score, because, order });
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(({ book, because }) => ({ book, because }));
}

/**
 * "Sortear um livro" (19/11/2026, dono: "o randomizer de indicação"). Sorteia entre livros do catálogo já baixados neste aparelho,
 * sem os que a pessoa tem e, enquanto houver outros, sem repetir os últimos sorteados. Quando a estante tem afinidade, metade dos
 * sorteios sai do "Para você". Sem candidatos devolve null: a tela carrega uma categoria antes, nunca inventa um livro.
 */
export function pickSurprise(
  candidates: CatalogBook[],
  affinity: Map<AldusCategory, number>,
  ownedCatalogIds: ReadonlySet<string>,
  recentIds: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
): CatalogBook | null {
  const unique = new Map<string, CatalogBook>();
  for (const book of candidates) if (!ownedCatalogIds.has(book.id) && !unique.has(book.id)) unique.set(book.id, book);
  const all = [...unique.values()];
  if (!all.length) return null;
  const fresh = all.filter(book => !recentIds.has(book.id));
  const pool = fresh.length ? fresh : all;
  const recommended = recommendFor(pool, affinity, ownedCatalogIds, pool.length).map(item => item.book);
  const from = recommended.length && random() < 0.5 ? recommended : pool;
  return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
}
