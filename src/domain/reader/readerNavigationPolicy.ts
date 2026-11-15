/**
 * Origem fictícia dos documentos do Reader nas WebViews nativas. Não existe na rede: serve só para o documento ter uma
 * origem https estável, sem acesso a arquivos do aparelho.
 */
export const READER_BASE_URL = "https://aldus-reader.local/";

/**
 * As WebViews do Reader mostram um documento gerado pelo app e nunca navegam para outro endereço. Um livro hostil pode
 * tentar levar a WebView a um site externo (link, redirecionamento, script); só o próprio documento e seus fragmentos passam.
 */
export function allowReaderNavigation(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url === "about:blank" || url === "about:srcdoc") return true;
  return url === READER_BASE_URL || url.startsWith(`${READER_BASE_URL}#`);
}
