/**
 * Leituras obrigatórias de vestibulares (25/11/2026, ideia do dono). A pessoa escolhe o vestibular e vê primeiro a lista da prova
 * que vem pela frente e, embaixo, as listas já usadas. Toda lista tem a fonte oficial (edital); sem lista publicada, o app diz isso
 * e não mostra nada inventado. As listas ficam no servidor (só o Admin publica) para chegarem sem atualizar o app.
 */
export interface Vestibular { id: string; name: string; institution: string; officialUrl: string | null }
export interface VestibularBook { position: number; title: string; author: string; note: string | null }
export interface VestibularReadingList {
  vestibularId: string;
  /** Ano da edição como o vestibular a chama (ex.: "Fuvest 2027" = ingresso em 2027). */
  examYear: number;
  /** Link do edital ou da página oficial de onde a lista foi copiada. Obrigatório. */
  sourceUrl: string;
  books: VestibularBook[];
}

export class VestibularContractError extends Error {}

const ID = /^[a-z0-9-]{2,40}$/;
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const httpsUrl = (value: unknown) => typeof value === "string" && /^https:\/\/[^\s]+$/.test(value) && value.length <= 500;

export function parseVestibulares(rows: unknown): Vestibular[] {
  if (!Array.isArray(rows)) throw new VestibularContractError("vestibulares");
  return rows.map((row: any) => {
    if (!row || !ID.test(row.id) || !text(row.name, 60) || !text(row.institution, 120) || (row.official_url != null && !httpsUrl(row.official_url))) throw new VestibularContractError("vestibular");
    return { id: row.id, name: row.name.trim(), institution: row.institution.trim(), officialUrl: row.official_url ?? null };
  });
}

export function parseReadingLists(rows: unknown): VestibularReadingList[] {
  if (!Array.isArray(rows)) throw new VestibularContractError("lists");
  return rows.map((row: any) => {
    if (!row || !ID.test(row.vestibular_id) || !Number.isInteger(row.exam_year) || row.exam_year < 1990 || row.exam_year > 2100 || !httpsUrl(row.source_url) || !Array.isArray(row.books) || row.books.length === 0 || row.books.length > 60) throw new VestibularContractError("list");
    const books = row.books.map((book: any, index: number) => {
      if (!book || !text(book.title, 200) || !text(book.author, 160) || (book.note != null && !text(book.note, 300))) throw new VestibularContractError("book");
      return { position: Number.isInteger(book.position) ? book.position : index + 1, title: book.title.trim(), author: book.author.trim(), note: book.note?.trim() || null };
    }).sort((a: VestibularBook, b: VestibularBook) => a.position - b.position);
    return { vestibularId: row.vestibular_id, examYear: row.exam_year, sourceUrl: row.source_url, books };
  });
}

/** A prova que a pessoa tem pela frente leva o ano de ingresso: no ano civil N, a edição que importa é a N + 1. */
export function targetExamYear(now: Date): number { return now.getFullYear() + 1; }

export interface VestibularReadingsView {
  targetYear: number;
  /** Listas das edições que ainda vão acontecer (inclui as já publicadas para anos seguintes), da mais próxima à mais distante. */
  upcoming: VestibularReadingList[];
  /** A lista da edição do ano-alvo ainda não foi publicada. */
  targetPending: boolean;
  /** Edições passadas, da mais recente para a mais antiga. */
  past: VestibularReadingList[];
}

export function vestibularReadingsView(lists: readonly VestibularReadingList[], vestibularId: string, now: Date): VestibularReadingsView {
  const targetYear = targetExamYear(now), own = lists.filter(list => list.vestibularId === vestibularId);
  // A edição com o nome do ano corrente ainda pode estar em andamento (segunda fase em janeiro): continua entre as próximas.
  const upcoming = own.filter(list => list.examYear >= now.getFullYear()).sort((a, b) => a.examYear - b.examYear);
  const past = own.filter(list => list.examYear < now.getFullYear()).sort((a, b) => b.examYear - a.examYear);
  return { targetYear, upcoming, targetPending: !own.some(list => list.examYear === targetYear), past };
}

/** Sugestão de quem usa o app (vestibular que falta ou correção numa lista). Vai ao Admin; nada é publicado sem conferência. */
export interface VestibularSuggestion { vestibularId: string | null; message: string }
export const SUGGESTION_MAX = 600;
export function validSuggestion(input: VestibularSuggestion): VestibularSuggestion {
  const message = input.message.trim();
  if (message.length < 5) throw new VestibularContractError("Escreva um pouco mais sobre a sugestão.");
  if (message.length > SUGGESTION_MAX) throw new VestibularContractError(`A sugestão pode ter até ${SUGGESTION_MAX} caracteres.`);
  if (input.vestibularId != null && !ID.test(input.vestibularId)) throw new VestibularContractError("vestibular");
  return { vestibularId: input.vestibularId, message };
}

/**
 * Admin: lista colada do edital, uma obra por linha, "Título — Autor" (aceita também " - " ou ";"). Numeração no começo e linhas vazias
 * são ignoradas. Linha sem autor é erro com o número dela: nada é publicado pela metade.
 */
export function parseBookLines(text: string): { books: VestibularBook[]; errors: string[] } {
  const books: VestibularBook[] = [], errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/^\s*\d+\s*[.)-]\s*/, "").trim();
    if (!line) return;
    const match = line.match(/^(.+?)\s+(?:—|–|-)\s+(.+)$/) ?? line.match(/^(.+?)\s*;\s*(.+)$/);
    if (!match) { errors.push(`Linha ${index + 1}: use "Título — Autor".`); return; }
    const title = match[1].trim(), author = match[2].trim();
    if (title.length > 200 || author.length > 160) { errors.push(`Linha ${index + 1}: título ou autor longo demais.`); return; }
    books.push({ position: books.length + 1, title, author, note: null });
  });
  if (!books.length && !errors.length) errors.push("Cole ao menos uma obra.");
  if (books.length > 60) errors.push("No máximo 60 obras por lista.");
  return { books, errors };
}
