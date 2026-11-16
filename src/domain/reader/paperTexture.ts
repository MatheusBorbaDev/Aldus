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
export interface PaperTextureLayers { grain: Layer | null; mottle: Layer | null; edge: Layer | null }

/**
 * Camadas do papel (refeito em 16/11/2026 depois do teste no aparelho: o grão anterior, até 8%, não aparecia na tela do celular).
 * Grão fino + manchas de fibra (baixa frequência) e, no envelhecido, bordas. As opacidades desejadas são reduzidas aos poucos
 * até o texto do livro manter 4,6:1 no pior pixel, então cada tema recebe o máximo de papel que a leitura permite.
 */
export function paperTextureLayers(texture: PaperTexture, background: string, text?: string): PaperTextureLayers {
  if (texture === "none") return { grain: null, mottle: null, edge: null };
  const dark = luminance(background) < 0.2;
  const color = dark ? "#FFFFFF" : "#4A3B2C";
  const aged = texture === "aged";
  const want = dark ? { grain: aged ? 0.12 : 0.10, mottle: aged ? 0.08 : 0.06, edge: aged ? 0.22 : 0 }
    : { grain: aged ? 0.24 : 0.20, mottle: aged ? 0.14 : 0.10, edge: aged ? 0.14 : 0 };
  const build = (scale: number): PaperTextureLayers => ({
    grain: { color, maxAlpha: round(want.grain * scale) },
    mottle: { color, maxAlpha: round(want.mottle * scale) },
    edge: want.edge ? { color: dark ? "#000000" : "#7A5A32", maxAlpha: round(want.edge * scale) } : null,
  });
  let scale = 1, layers = build(scale);
  while (text && scale > 0.2 && contrast(text, worst(background, layers)) < 4.6) { scale -= 0.05; layers = build(scale); }
  return layers;
}

/** Valor de `background-image` do documento; `none` desliga. Só usa `data:` (a CSP do documento já permite). Bloco de 400 px. */
export function paperTextureCss(texture: PaperTexture, background: string, text?: string): string {
  const { grain, mottle, edge } = paperTextureLayers(texture, background, text);
  if (!grain || !mottle) return "none";
  const [r, g, b] = rgb(grain.color).map(value => (value / 255).toFixed(3));
  // A opacidade do ruído fica perto de 0,5; a tabela espalha esse intervalo entre 0 e o máximo (antes virava um tom quase liso).
  const table = (max: number) => [0, 0, 0, max * 0.25, max * 0.6, max, max].map(v => v.toFixed(3)).join(" ");
  const layer = (id: string, frequency: string, octaves: number, seed: number, max: number) =>
    `<filter id='${id}' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0'/><feComponentTransfer><feFuncA type='table' tableValues='${table(max)}'/></feComponentTransfer></filter>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>${layer("m", aged(texture) ? "0.012" : "0.016", 2, 11, mottle.maxAlpha)}${layer("g", aged(texture) ? "0.75" : "0.9", 3, 7, grain.maxAlpha)}<rect width='100%' height='100%' filter='url(#m)'/><rect width='100%' height='100%' filter='url(#g)'/></svg>`;
  const tile = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  if (!edge) return tile;
  const [er, eg, eb] = rgb(edge.color);
  return `${tile}, radial-gradient(ellipse at center, rgba(${er}, ${eg}, ${eb}, 0) 55%, rgba(${er}, ${eg}, ${eb}, ${edge.maxAlpha}) 100%)`;
}

/** Fundo no pior pixel (todas as camadas no máximo): base para conferir o contraste do texto. */
export function paperTextureWorstBackground(texture: PaperTexture, background: string, text?: string): string {
  return worst(background, paperTextureLayers(texture, background, text));
}

function worst(background: string, layers: PaperTextureLayers) {
  let color = rgb(background);
  for (const layer of [layers.edge, layers.mottle, layers.grain]) if (layer) color = blend(color, rgb(layer.color), layer.maxAlpha);
  return `#${color.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0")).join("")}`;
}

const aged = (texture: PaperTexture) => texture === "aged";
const round = (value: number) => Math.round(value * 1000) / 1000;
function contrast(a: string, b: string) { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); }

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
