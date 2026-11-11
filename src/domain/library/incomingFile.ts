/**
 * "Abrir com Aldus" (onda C3): o Android entrega o documento como `content://…`. Só esse esquema é aceito (nada de http, file ou
 * javascript vindo de outro app). O nome mostrado vem do último trecho do endereço; quando ele é só um número (provedores que não
 * expõem o nome), usamos um rótulo neutro. O formato real é detectado pelos bytes no importador, não pelo nome.
 */
export function incomingFileUri(path: string | null | undefined): string | null {
  if (typeof path !== "string") return null;
  const value = path.trim();
  return /^content:\/\/[^\s]+$/i.test(value) && value.length <= 4096 ? value : null;
}

export function incomingFileName(uri: string): string {
  let last = uri.split(/[/?#]/).filter(Boolean).pop() ?? "";
  try { last = decodeURIComponent(last); } catch { /* keep raw segment */ }
  last = last.split(/[:/]/).filter(Boolean).pop() ?? "";
  const cleaned = last.replace(/[\u0000-\u001f<>"|*?\\]/g, "").trim().slice(0, 160);
  return cleaned && !/^\d+$/.test(cleaned) ? cleaned : "Livro recebido";
}

/** Rota interna para um caminho de sistema; outros caminhos seguem como estão. */
export function routeForSystemPath(path: string): string {
  const uri = incomingFileUri(path);
  return uri ? `/open-file?uri=${encodeURIComponent(uri)}` : path;
}
