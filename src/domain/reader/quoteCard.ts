import { appPalettes, AppPaletteName } from "@/src/theme/tokens";

/**
 * Card de trecho para compartilhar (Fase C, pedido do dono em 16/11/2026, estilo Spotify). Decisões do dono: limite de 400
 * caracteres (acima disso o app pede para encurtar, nunca corta em silêncio), envio pela folha de compartilhamento do sistema,
 * sem botão direto de Stories. Leva só o trecho, título e autor (ocultáveis) e a marca Aldus (ocultável); nunca o arquivo do
 * livro nem um link para ele. As cores vêm das paletas do app.
 */
export const QUOTE_CARD_MAX_CHARACTERS = 400;

export type QuoteCardFormat = "story" | "portrait" | "square";
export type QuoteCardTemplate = "paper" | "light" | "night" | "accent";

export const QUOTE_CARD_FORMATS: ReadonlyArray<{ value: QuoteCardFormat; label: string; width: number; height: number }> = [
  { value: "story", label: "Stories 9:16", width: 1080, height: 1920 },
  { value: "portrait", label: "Post 4:5", width: 1080, height: 1350 },
  { value: "square", label: "Quadrado 1:1", width: 1080, height: 1080 },
];

export const QUOTE_CARD_TEMPLATES: ReadonlyArray<{ value: QuoteCardTemplate; label: string }> = [
  { value: "paper", label: "Papel" },
  { value: "light", label: "Claro" },
  { value: "night", label: "Noite" },
  { value: "accent", label: "Destaque" },
];

export interface QuoteCardSpec {
  width: number;
  height: number;
  background: string;
  text: string;
  secondary: string;
  accent: string;
  grain: boolean;
  quote: string;
  book: string | null;
  author: string | null;
  brand: boolean;
}

/** Trecho normalizado (espaços colapsados) ou a mensagem que explica por que não pode virar card. */
export function validateQuoteForCard(quote: string): { ok: true; quote: string } | { ok: false; message: string } {
  const clean = quote.replace(/\s+/g, " ").trim();
  if (!clean) return { ok: false, message: "Selecione um trecho para criar o card." };
  if (clean.length > QUOTE_CARD_MAX_CHARACTERS) {
    return { ok: false, message: `O card aceita até ${QUOTE_CARD_MAX_CHARACTERS} caracteres (este trecho tem ${clean.length}). Use “Tirar a última” no grifo para encurtar.` };
  }
  return { ok: true, quote: clean };
}

export function buildQuoteCardSpec(input: {
  quote: string; title: string | null; author: string | null; showBook: boolean; showBrand: boolean;
  format: QuoteCardFormat; template: QuoteCardTemplate; paletteName: AppPaletteName;
}): QuoteCardSpec {
  const checked = validateQuoteForCard(input.quote);
  if (!checked.ok) throw new Error(checked.message);
  const format = QUOTE_CARD_FORMATS.find(item => item.value === input.format) ?? QUOTE_CARD_FORMATS[0];
  const palette = appPalettes[input.paletteName] ?? appPalettes.classic;
  const light = input.template === "paper" ? appPalettes.classic.light : palette.light, dark = palette.dark;
  const colors = input.template === "night" ? { background: dark.background, text: dark.text, secondary: dark.secondaryText, accent: dark.accent }
    : input.template === "accent" ? { background: light.accent, text: light.onAccent, secondary: light.onAccent, accent: light.onAccent }
    : { background: light.background, text: light.text, secondary: light.secondaryText, accent: light.accent };
  const title = input.showBook ? (input.title ?? "").replace(/\s+/g, " ").trim() : "";
  const author = input.showBook ? (input.author ?? "").replace(/\s+/g, " ").trim() : "";
  return { width: format.width, height: format.height, ...colors, grain: input.template === "paper", quote: checked.quote, book: title || null, author: author || null, brand: input.showBrand };
}

/**
 * Desenho do card em canvas 2D. Fonte JavaScript literal (o `Function.toString()` do Hermes não é fonte executável): roda na
 * WebView do Android e no site. `renderQuoteCard(ctx, spec, makeCanvas)` devolve o tamanho de letra e as linhas usadas.
 */
export const QUOTE_CARD_RENDERER = `
function renderQuoteCard(ctx, spec, makeCanvas) {
  var W = spec.width, H = spec.height, M = Math.round(W * 0.09), serif = 'Georgia, "Noto Serif", "Times New Roman", serif', sans = 'Roboto, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = spec.background; ctx.fillRect(0, 0, W, H);
  if (spec.grain && makeCanvas) {
    var tile = makeCanvas(160, 160), tctx = tile.getContext('2d'), img = tctx.createImageData(160, 160), seed = 7;
    for (var i = 0; i < img.data.length; i += 4) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; img.data[i] = 74; img.data[i + 1] = 59; img.data[i + 2] = 44; img.data[i + 3] = (seed % 1000) / 1000 * 26; }
    tctx.putImageData(img, 0, 0); ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W, H);
  }
  function wrap(text, size, font, maxWidth) {
    ctx.font = font.replace('SIZE', size); var words = text.split(' '), lines = [], line = '';
    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      while (ctx.measureText(word).width > maxWidth && word.length > 1) {
        var cut = word.length - 1; while (cut > 1 && ctx.measureText(word.slice(0, cut) + '-').width > maxWidth) cut--;
        if (line) { lines.push(line); line = ''; } lines.push(word.slice(0, cut) + '-'); word = word.slice(cut);
      }
      var next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width <= maxWidth) line = next; else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line); return lines;
  }
  function clamp(lines, max, font, maxWidth) {
    if (lines.length <= max) return lines; var kept = lines.slice(0, max), last = kept[max - 1];
    ctx.font = font; while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    kept[max - 1] = last.replace(/[\\s.,;:]+$/, '') + '…'; return kept;
  }
  var top = M, width = W - M * 2;
  if (spec.brand) {
    ctx.fillStyle = spec.accent; ctx.beginPath(); ctx.arc(M + 12, top + 16, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = spec.secondary; ctx.font = '600 34px ' + sans; ctx.textBaseline = 'middle'; ctx.fillText('ALDUS', M + 40, top + 17);
  }
  // Bloco (aspas, trecho, título e autor) centralizado na altura livre; trecho curto ganha letra maior no formato alto.
  var regionTop = top + Math.round(H * 0.05), regionBottom = H - M, markHeight = Math.round(W * 0.17);
  var bookFont = '700 40px ' + serif, bookLines = spec.book ? clamp(wrap(spec.book, 40, '700 SIZEpx ' + serif, width), 2, bookFont, width) : [];
  var footer = (spec.book || spec.author) ? 44 + 56 + bookLines.length * 52 + (spec.author ? 12 : 0) : 0;
  var available = regionBottom - regionTop - markHeight - footer;
  var size = Math.round(W * (H / W > 1.5 ? 0.082 : 0.07)), min = Math.round(W * 0.032), font = 'SIZE' + 'px ' + serif, lines, lineHeight;
  for (;;) { lines = wrap(spec.quote, size, font, width); lineHeight = Math.round(size * 1.38); if (lines.length * lineHeight <= available || size <= min) break; size -= 2; }
  if (lines.length * lineHeight > available) lines = clamp(lines, Math.max(1, Math.floor(available / lineHeight)), size + 'px ' + serif, width);
  var block = markHeight + lines.length * lineHeight + footer, start = regionTop + Math.max(0, Math.round((regionBottom - regionTop - block) * 0.45));
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = spec.accent; ctx.font = '700 ' + Math.round(W * 0.2) + 'px ' + serif; ctx.fillText('“', M - 8, start + Math.round(W * 0.15));
  var quoteTop = start + markHeight;
  ctx.fillStyle = spec.text; ctx.font = size + 'px ' + serif;
  for (var l = 0; l < lines.length; l++) ctx.fillText(lines[l], M, quoteTop + size + l * lineHeight);
  var y = quoteTop + lines.length * lineHeight + 44;
  if (spec.book || spec.author) {
    ctx.fillStyle = spec.accent; ctx.fillRect(M, y, 72, 6); y += 56;
    if (spec.book) { ctx.fillStyle = spec.text; ctx.font = bookFont; for (var b = 0; b < bookLines.length; b++) { ctx.fillText(bookLines[b], M, y); y += 52; } }
    if (spec.author) { var authorFont = '34px ' + sans, authorLine = clamp(wrap(spec.author, 34, 'SIZEpx ' + sans, width), 1, authorFont, width)[0]; ctx.fillStyle = spec.secondary; ctx.font = authorFont; ctx.fillText(authorLine, M, y); }
  }
  return { fontSize: size, lines: lines };
}
`;
