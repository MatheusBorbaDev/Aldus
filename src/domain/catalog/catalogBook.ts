/**
 * Catálogo de livros só com metadados (plano de 18/11/2026, docs/context/biblioteca-sync.md §7). Um item do catálogo descreve
 * uma obra: nunca traz conteúdo, arquivo nem link de download. Campo ausente na fonte fica vazio (null ou lista vazia);
 * nenhum número é inventado.
 */
export type CatalogSourceName = "openlibrary" | "wikidata" | "file";

export const ALDUS_CATEGORIES = {
  romance: "Romance",
  classicos: "Clássicos",
  "literatura-brasileira": "Literatura brasileira",
  fantasia: "Fantasia",
  "ficcao-cientifica": "Ficção científica",
  "misterio-suspense": "Mistério e suspense",
  terror: "Terror",
  poesia: "Poesia",
  contos: "Contos e crônicas",
  teatro: "Teatro",
  "infantojuvenil": "Infantojuvenil",
  quadrinhos: "Quadrinhos",
  biografia: "Biografias e memórias",
  historia: "História",
  filosofia: "Filosofia",
  ciencia: "Ciência",
  sociedade: "Sociedade e política",
  religiao: "Religião e espiritualidade",
  "desenvolvimento-pessoal": "Desenvolvimento pessoal",
  negocios: "Negócios e economia",
  estudo: "Estudo e referência",
} as const;
export type AldusCategory = keyof typeof ALDUS_CATEGORIES;

export interface CatalogBook {
  /** `<fonte>:<id da fonte>`, por exemplo `ol:OL45883W`. */
  id: string;
  source: CatalogSourceName;
  title: string;
  subtitle: string | null;
  authors: string[];
  firstPublishYear: number | null;
  /** Códigos de idioma como a fonte informa (ex.: `por`, `eng`). */
  languages: string[];
  /** ISBN-13 válidos (dígito verificador conferido). */
  isbns: string[];
  pages: number | null;
  /** Assuntos como a fonte informa, no máximo 30; servem para as categorias e as recomendações. */
  subjects: string[];
  categories: AldusCategory[];
  /** Só capas do Open Library por número de capa (https://covers.openlibrary.org/b/id/…). */
  coverUrl: string | null;
  /** Página da obra na fonte, para dar o crédito. */
  sourceUrl: string | null;
}

const clean = (value: unknown, max = 300): string | null => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};
const list = (value: unknown, max: number, each = 200): string[] =>
  Array.isArray(value) ? [...new Set(value.map(item => clean(item, each)).filter((item): item is string => !!item))].slice(0, max) : [];

/** ISBN-10 ou ISBN-13 com dígito verificador válido, convertido para ISBN-13; qualquer outra coisa é null. */
export function normalizeIsbn(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(raw)) {
    const sum = raw.split("").reduce((total, char, index) => total + (char === "X" ? 10 : Number(char)) * (10 - index), 0);
    if (sum % 11 !== 0) return null;
    const body = "978" + raw.slice(0, 9);
    return body + isbn13Check(body);
  }
  if (/^97[89]\d{10}$/.test(raw)) return isbn13Check(raw.slice(0, 12)) === raw[12] ? raw : null;
  return null;
}
function isbn13Check(twelve: string): string {
  const sum = twelve.split("").reduce((total, char, index) => total + Number(char) * (index % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

const COVER_URL = /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d{1,12}-[SML]\.jpg$/;
const SOURCE_URL = /^https:\/\/(?:openlibrary\.org\/works\/OL\d+W|www\.wikidata\.org\/wiki\/Q\d+)$/;

/** Valida um item vindo de fora (rede ou cache). Inválido = null; nunca completa campo com valor inventado. */
export function parseCatalogBook(value: unknown): CatalogBook | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = clean(item.id, 80), title = clean(item.title);
  const source = item.source === "openlibrary" || item.source === "wikidata" || item.source === "file" ? item.source : null;
  if (!id || !/^(?:ol|wd|file):[\w.-]{1,70}$/.test(id) || !title || !source) return null;
  const year = typeof item.firstPublishYear === "number" && Number.isInteger(item.firstPublishYear) && item.firstPublishYear > 0 && item.firstPublishYear <= 2100 ? item.firstPublishYear : null;
  const pages = typeof item.pages === "number" && Number.isInteger(item.pages) && item.pages > 0 && item.pages < 100000 ? item.pages : null;
  const coverUrl = typeof item.coverUrl === "string" && COVER_URL.test(item.coverUrl) ? item.coverUrl : null;
  const sourceUrl = typeof item.sourceUrl === "string" && SOURCE_URL.test(item.sourceUrl) ? item.sourceUrl : null;
  const subjects = list(item.subjects, 30, 120);
  return {
    id, source, title, subtitle: clean(item.subtitle), authors: list(item.authors, 10), firstPublishYear: year,
    languages: list(item.languages, 10, 12), isbns: list(item.isbns, 20, 20).map(normalizeIsbn).filter((isbn): isbn is string => !!isbn),
    pages, subjects, categories: categoriesFor(subjects), coverUrl, sourceUrl,
  };
}

/** Normaliza para comparar títulos e autores (sem acento, minúsculas, sem pontuação). */
export function catalogKey(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Junta resultados repetidos (mesmo título e primeiro autor), preferindo o mais completo, e mantém a ordem da fonte. */
export function mergeCatalogBooks(books: CatalogBook[]): CatalogBook[] {
  const out = new Map<string, CatalogBook>();
  for (const book of books) {
    const key = `${catalogKey(book.title)}|${catalogKey(book.authors[0] ?? "")}`;
    const previous = out.get(key);
    if (!previous) { out.set(key, book); continue; }
    out.set(key, {
      ...previous,
      subtitle: previous.subtitle ?? book.subtitle,
      firstPublishYear: previous.firstPublishYear ?? book.firstPublishYear,
      pages: previous.pages ?? book.pages,
      coverUrl: previous.coverUrl ?? book.coverUrl,
      isbns: [...new Set([...previous.isbns, ...book.isbns])].slice(0, 20),
      languages: [...new Set([...previous.languages, ...book.languages])].slice(0, 10),
      subjects: [...new Set([...previous.subjects, ...book.subjects])].slice(0, 30),
      categories: [...new Set([...previous.categories, ...book.categories])],
    });
  }
  return [...out.values()];
}

/**
 * Categorias do Aldus a partir dos assuntos da fonte (português e inglês). Sem assunto conhecido, nenhuma categoria:
 * o livro não é encaixado à força.
 */
const RULES: ReadonlyArray<[AldusCategory, RegExp]> = [
  ["quadrinhos", /\b(comic|comics|graphic novel|manga|quadrinho|hq)\b/],
  ["infantojuvenil", /\b(juvenile|children|young adult|infantil|juvenil|infantojuvenil)\b/],
  ["ficcao-cientifica", /\b(science fiction|ficcao cientifica|dystopia|distopia|space opera)\b/],
  ["fantasia", /\b(fantasy|fantasia|magic|magia|dragons?)\b/],
  ["terror", /\b(horror|terror|ghost stories?|vampires?)\b/],
  ["misterio-suspense", /\b(mystery|detective|crime|thriller|suspense|misterio|policial)\b/],
  ["poesia", /\b(poetry|poems?|poesia|poemas?|sonnets?)\b/],
  ["teatro", /\b(drama|plays?|theater|theatre|teatro)\b/],
  ["contos", /\b(short stories|contos?|cronicas?)\b/],
  ["biografia", /\b(biography|autobiography|memoirs?|biografia|memorias)\b/],
  ["historia", /\b(history|historia|historical|historico)\b/],
  ["filosofia", /\b(philosophy|filosofia|ethics|etica)\b/],
  ["ciencia", /\b(science(?! fiction)|ciencia|physics|fisica|biology|biologia|chemistry|quimica|mathematics|matematica|astronomy)\b/],
  ["sociedade", /\b(politics|politica|sociology|sociologia|social sciences?|economia politica)\b/],
  ["religiao", /\b(religion|religiao|spirituality|espiritualidade|christianity|bible|biblia|theology|teologia)\b/],
  ["desenvolvimento-pessoal", /\b(self help|self-help|autoajuda|personal development|desenvolvimento pessoal|motivation)\b/],
  ["negocios", /\b(business|negocios|management|gestao|economics|economia|finance|financas|marketing)\b/],
  ["estudo", /\b(study and teaching|textbooks?|didatico|vestibular|concursos?|dictionar(y|ies)|dicionario|reference|grammar|gramatica)\b/],
  ["literatura-brasileira", /\b(brazilian (fiction|literature|poetry)|literatura brasileira|brazil fiction)\b/],
  ["classicos", /\b(classic|classics|classicos?|literatura classica)\b/],
  ["romance", /\b(romance|love stories|historias de amor|fiction romance|novela romantica)\b/],
];
export function categoriesFor(subjects: string[]): AldusCategory[] {
  const text = subjects.map(catalogKey).join(" | ");
  return RULES.filter(([, rule]) => rule.test(text)).map(([category]) => category).slice(0, 4);
}
