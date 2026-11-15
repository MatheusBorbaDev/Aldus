/**
 * Filtro do HTML de livros (EPUB e Leitura Livre) antes de entrar no documento do Reader. O conteúdo de um livro é entrada
 * não confiável: vem de arquivos importados, catálogos e Drive.
 *
 * O filtro antigo removia trechos com expressões regulares numa única passada e era contornável (`<scr<script>ipt>`,
 * `<img src="x"onerror=…>`, `java&#115;cript:`, `<me<meta>ta http-equiv=refresh>`). Este reconstrói o HTML: lê as tags como o
 * navegador as lê, descarta as proibidas e **reemite** cada tag permitida com atributos normalizados e entre aspas. Todo `<` que
 * não pertence a uma tag reemitida vira `&lt;`, então nenhuma tag chega ao documento sem ter passado por aqui.
 *
 * É uma camada; as outras são a CSP com nonce do documento (scripts e manipuladores do livro não executam mesmo que sobrem) e o
 * bloqueio de navegação no Reader.
 */

/** Elementos removidos junto com o conteúdo. */
const REMOVED_WITH_CONTENT = ["script", "iframe", "frame", "frameset", "object", "embed", "applet", "form"];
/** Tags removidas; o texto de dentro, se houver, fica como texto. */
const REMOVED_TAGS = new Set([...REMOVED_WITH_CONTENT, "meta", "base", "link", "plaintext", "xmp", "noembed", "noframes", "noscript",
  "textarea", "title", "template", "portal", "dialog", "html", "head", "body"]);
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "poster", "data", "background", "cite", "longdesc", "srcset", "action", "formaction"]);
const REMOVED_ATTRIBUTES = new Set(["srcdoc", "formaction", "action", "ping", "http-equiv", "manifest", "nonce", "autofocus", "contenteditable", "target"]);
const ALLOWED_SCHEMES = /^(?:https?:|mailto:|blob:|file:|data:image\/)/;

const CONTAINER = new RegExp(`<(${REMOVED_WITH_CONTENT.join("|")})(?=[\\s/>])[\\s\\S]*?<\\/\\1[^>]*>`, "gi");
const TAG = /<(\/?)([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const NAMED: Record<string, string> = { colon: ":", tab: "\t", newline: "\n", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", sol: "/", lpar: "(", rpar: ")" };
function decodeEntities(value: string): string {
  return value.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z]+));?/gi, (match, hex, decimal, name) => {
    if (name) return NAMED[name.toLowerCase()] ?? match;
    const code = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

/** true quando o valor é relativo, um fragmento ou usa um esquema permitido, depois de desfazer entidades e espaços/controles. */
export function isSafeBookUrl(value: string): boolean {
  let decoded = value;
  for (let i = 0; i < 3; i++) { const next = decodeEntities(decoded); if (next === decoded) break; decoded = next; }
  // Navegadores ignoram espaços e caracteres de controle dentro do esquema (tabulação no meio de "javascript:", por exemplo); compara sem eles.
  let compact = "";
  for (const char of decoded) {
    const code = char.codePointAt(0) ?? 0;
    const ignorable = code <= 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0x200b && code <= 0x200f) || code === 0x2028 || code === 0x2029 || code === 0xfeff;
    if (!ignorable) compact += char.toLowerCase();
  }
  if (!/^[a-z][a-z0-9+.-]*:/.test(compact)) return true;
  return ALLOWED_SCHEMES.test(compact);
}

const escapeText = (text: string) => text.replace(/</g, "&lt;");
const escapeValue = (value: string) => value.replace(/"/g, "&quot;").replace(/</g, "&lt;");

function rebuildAttributes(span: string): string {
  let output = "";
  const seen = new Set<string>();
  for (const match of span.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    if (!/^[a-z_:][a-z0-9_:.-]*$/.test(name) || name.startsWith("on") || REMOVED_ATTRIBUTES.has(name) || seen.has(name)) continue;
    const value = match[2] ?? match[3] ?? match[4];
    if (value !== undefined && URL_ATTRIBUTES.has(name)) {
      const urls = name === "srcset" ? value.split(",").map(part => part.trim().split(/\s+/)[0]) : [value];
      if (!urls.every(isSafeBookUrl)) continue;
    }
    // CSS não executa código nos navegadores atuais, mas url() com esquema ativo não tem uso legítimo num livro.
    if (name === "style" && value !== undefined && /(?:javascript|vbscript)\s*:|expression\s*\(|-moz-binding/i.test(decodeEntities(value))) continue;
    seen.add(name);
    output += value === undefined ? ` ${name}` : ` ${name}="${escapeValue(value)}"`;
  }
  return output;
}

export function sanitizeBookHtml(html: string): string {
  if (!html) return "";
  // Comentários e instruções de processamento não carregam conteúdo do livro e escondem marcação de filtros.
  let source = html.replace(/<!--[\s\S]*?(?:-->|$)/g, "").replace(/<\?[\s\S]*?\?>/g, "");
  // Uma remoção pode juntar as bordas de outro elemento proibido; repete até estabilizar.
  for (let i = 0; i < 20; i++) { const next = source.replace(CONTAINER, ""); if (next === source) break; source = next; }

  let output = "", cursor = 0, openStyles = 0;
  for (const match of source.matchAll(TAG)) {
    output += escapeText(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const closing = match[1] === "/", name = match[2].toLowerCase();
    if (REMOVED_TAGS.has(name) || !/^[a-z][a-z0-9:-]*$/.test(name)) continue;
    if (name === "style") openStyles += closing ? -1 : 1;
    if (closing) { output += `</${name}>`; continue; }
    const selfClosing = /\/\s*$/.test(match[3]);
    output += `<${name}${rebuildAttributes(match[3])}${selfClosing ? " /" : ""}>`;
  }
  output += escapeText(source.slice(cursor));
  // Um <style> sem fechamento engoliria o resto do documento do Reader (inclusive o script dele).
  for (; openStyles > 0; openStyles--) output += "</style>";
  return output;
}
