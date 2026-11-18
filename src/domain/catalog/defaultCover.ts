/**
 * Capa padrão Aldus (aprovada pelo dono em 18/11/2026; especificação em docs/context/design-system.md). Para livro sem capa:
 * gerada no aparelho, nunca baixada. O mesmo título + autor (normalizados) gera sempre a mesma capa; a cor vem do próprio livro,
 * não da categoria, para a estante variar. Puro: o desenho em si fica na apresentação.
 */
export interface AldusCoverPalette { name: string; background: string; glow: string; text: string; accent: string }
export const ALDUS_COVER_PALETTES: readonly AldusCoverPalette[] = [
  { name: "noite", background: "#1B1C30", glow: "#25273F", text: "#F1E8D8", accent: "#C9A46A" },
  { name: "petroleo", background: "#0E4A45", glow: "#135A54", text: "#EEF2EC", accent: "#D9B56E" },
  { name: "terracota", background: "#8A3B25", glow: "#9E4A31", text: "#F8EEE2", accent: "#F0CB97" },
  { name: "vinho", background: "#55202C", glow: "#672A37", text: "#F4E8E4", accent: "#DDB070" },
  { name: "musgo", background: "#2E3826", glow: "#3A4630", text: "#EEEDE0", accent: "#CDB675" },
  { name: "tinta", background: "#1E3A84", glow: "#284A9C", text: "#EEF1FA", accent: "#E6C47C" },
  { name: "papel", background: "#EFE6D6", glow: "#F6EFE3", text: "#1B1C30", accent: "#A64E32" },
];
export type AldusCoverOrnament = "arcos" | "trelica" | "raios";
const ORNAMENTS: readonly AldusCoverOrnament[] = ["arcos", "trelica", "raios"];

export interface AldusCoverDesign {
  palette: AldusCoverPalette;
  ornament: AldusCoverOrnament;
  title: string;
  author: string;
  /** Tamanho do título em unidades da capa (largura 400), do maior ao menor conforme o comprimento. */
  titleSize: number;
  titleLines: number;
}

/** FNV-1a de 32 bits: estável entre plataformas, sem dependência. */
export function coverHash(value: string): number {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.codePointAt(0)!; hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export function cleanCoverTitle(title: string): string {
  return title.replace(/\.(?:epub|pdf)\s*$/i, "").replace(/\s+/g, " ").trim() || "Sem título";
}
export function cleanCoverAuthor(author?: string | null): string {
  const value = author?.replace(/\s+/g, " ").trim();
  return !value || /^(?:Autor desconhecido|Arquivo local)$/i.test(value) ? "Autor não informado" : value;
}

export function aldusCoverDesign(rawTitle: string, rawAuthor?: string | null): AldusCoverDesign {
  const title = cleanCoverTitle(rawTitle), author = cleanCoverAuthor(rawAuthor);
  const hash = coverHash(`${title}|${author}`.toLocaleLowerCase("pt-BR"));
  const length = title.length;
  // Títulos curtos ganham letra grande; longos descem até 21 e podem usar até 5 linhas.
  const titleSize = length <= 12 ? 40 : length <= 20 ? 36 : length <= 30 ? 32 : length <= 42 ? 29 : length <= 60 ? 26 : length <= 80 ? 23 : 21;
  return {
    palette: ALDUS_COVER_PALETTES[hash % ALDUS_COVER_PALETTES.length],
    ornament: ORNAMENTS[(hash >>> 8) % ORNAMENTS.length],
    title, author, titleSize, titleLines: titleSize >= 32 ? 3 : 5,
  };
}
