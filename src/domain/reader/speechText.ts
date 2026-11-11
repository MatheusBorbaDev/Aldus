/**
 * Texto para leitura em voz alta (onda C1). Tudo puro e testável: HTML do capítulo → texto, ponto de partida aproximado pela página
 * atual dentro do capítulo, e divisão em trechos por frase (o Android limita cada fala a ~4000 caracteres).
 */
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»" };

export function htmlToSpeechText(html: string): string {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") { const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10); return Number.isFinite(code) ? String.fromCodePoint(code) : " "; }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/**
 * Ponto de partida proporcional à página atual dentro do capítulo (aproximado: as páginas não têm o mesmo número de caracteres),
 * recuado até o início da frase em que essa posição cai: reler um pouco é melhor do que pular texto ou começar no meio da palavra.
 */
export function speechStartOffset(text: string, page: number, chapterStartPage: number, nextChapterStartPage: number): number {
  const pages = Math.max(1, nextChapterStartPage - chapterStartPage);
  const fraction = Math.max(0, Math.min(1, (page - chapterStartPage) / pages));
  const rough = Math.floor(text.length * fraction);
  if (rough <= 0) return 0;
  const boundary = /[.!?…]\s+|\n/g;
  let start = 0, match: RegExpExecArray | null;
  while ((match = boundary.exec(text)) && match.index < rough) start = match.index + match[0].length;
  return start + (text.slice(start).length - text.slice(start).trimStart().length);
}

/** Trechos de até `max` caracteres, quebrando em fim de frase sempre que possível. */
export function splitForSpeech(text: string, max = 3000): string[] {
  const sentences = text.match(/[^.!?…\n]+(?:[.!?…]+|\n|$)/g)?.map(part => part.trim()).filter(Boolean) ?? [];
  const chunks: string[] = []; let current = "";
  for (const sentence of sentences) {
    if (sentence.length > max) {
      if (current) { chunks.push(current); current = ""; }
      for (let i = 0; i < sentence.length; i += max) chunks.push(sentence.slice(i, i + max));
      continue;
    }
    if ((current ? current.length + 1 : 0) + sentence.length > max) { chunks.push(current); current = sentence; }
    else current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) chunks.push(current);
  return chunks;
}
