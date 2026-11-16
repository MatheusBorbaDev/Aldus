/**
 * Textura de papel na página do livro (pedido do dono em 16/11/2026). O grão é gerado aqui (SVG `feTurbulence` em `data:`,
 * sem imagem de terceiros nem arquivo no pacote) e aplicado só como imagem de fundo do documento do Reader: não muda fonte,
 * margem, paginação nem posição. Livro claro recebe grão escuro; livro escuro, grão claro. A opacidade máxima de cada
 * camada é limitada para que o texto mantenha 4,5:1 até no pixel mais marcado (contrato em `scripts/test-paper-texture.cjs`).
 * Vale para EPUB e Leitura Livre; o PDF Original não recebe textura (as páginas são imagens opacas).
 */
export type PaperTexture = "none" | "paper" | "aged";

export const PAPER_TEXTURES: ReadonlyArray<{ value: PaperTexture; label: string }> = [
  { value: "none", label: "Sem textura" },
  { value: "paper", label: "Papel" },
  { value: "aged", label: "Papel envelhecido" },
];

export function isPaperTexture(value: unknown): value is PaperTexture {
  return value === "none" || value === "paper" || value === "aged";
}

interface Layer { color: string; maxAlpha: number }

/** Camadas que escurecem/clareiam o fundo: grão (até `maxAlpha` por pixel) e, no envelhecido, a mancha das bordas. */
export function paperTextureLayers(texture: PaperTexture, background: string): { grain: Layer | null; edge: Layer | null } {
  if (texture === "none") return { grain: null, edge: null };
  const dark = luminance(background) < 0.2;
  const grainColor = dark ? "#FFFFFF" : "#4A3B2C";
  const grain = { color: grainColor, maxAlpha: texture === "aged" ? (dark ? 0.07 : 0.12) : (dark ? 0.05 : 0.08) };
  const edge = texture === "aged" ? { color: dark ? "#000000" : "#7A5A32", maxAlpha: dark ? 0.18 : 0.08 } : null;
  return { grain, edge };
}

/** Valor de `background-image` do documento; `none` desliga. Só usa `data:` (a CSP do documento já permite). */
export function paperTextureCss(texture: PaperTexture, background: string): string {
  const { grain, edge } = paperTextureLayers(texture, background);
  if (!grain) return "none";
  const [r, g, b] = rgb(grain.color).map(value => (value / 255).toFixed(3));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${texture === "aged" ? "0.75" : "0.9"}' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${grain.maxAlpha} 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`;
  const tile = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  if (!edge) return tile;
  const [er, eg, eb] = rgb(edge.color);
  return `${tile}, radial-gradient(ellipse at center, rgba(${er}, ${eg}, ${eb}, 0) 55%, rgba(${er}, ${eg}, ${eb}, ${edge.maxAlpha}) 100%)`;
}

/** Fundo no pior pixel (todas as camadas no máximo): base para conferir o contraste do texto. */
export function paperTextureWorstBackground(texture: PaperTexture, background: string): string {
  const { grain, edge } = paperTextureLayers(texture, background);
  let color = rgb(background);
  for (const layer of [edge, grain]) if (layer) color = blend(color, rgb(layer.color), layer.maxAlpha);
  return `#${color.map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function rgb(hex: string): number[] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean.slice(0, 6);
  return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) || 0);
}

function blend(base: number[], over: number[], alpha: number) {
  return base.map((value, index) => value * (1 - alpha) + over[index] * alpha);
}

function luminance(hex: string) {
  const channels = rgb(hex).map(value => value / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
