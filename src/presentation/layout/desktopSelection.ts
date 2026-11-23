/**
 * Biblioteca do PC (23/11/2026): clique com Ctrl/Shift, como num gerenciador de arquivos.
 * Ctrl (ou Cmd) marca/desmarca um livro e vira a âncora; Shift soma o intervalo da âncora até o livro, na ordem mostrada.
 */
export interface PointerKeys { toggle: boolean; range: boolean }

export const noPointerKeys: PointerKeys = { toggle: false, range: false };

/** Teclas do clique, vindas do evento do navegador (o React Native Web repassa o MouseEvent). */
export function pointerKeysFrom(event: unknown): PointerKeys {
  const native = (event as { nativeEvent?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } } | null)?.nativeEvent;
  return { toggle: Boolean(native?.ctrlKey || native?.metaKey), range: Boolean(native?.shiftKey) };
}

export function pointerSelection(order: readonly string[], current: ReadonlySet<string>, anchor: string | null, id: string, keys: PointerKeys): { selection: Set<string>; anchor: string } {
  const next = new Set(current);
  const from = anchor === null ? -1 : order.indexOf(anchor), to = order.indexOf(id);
  if (keys.range && from >= 0 && to >= 0) {
    for (let index = Math.min(from, to); index <= Math.max(from, to); index++) next.add(order[index]);
    return { selection: next, anchor: anchor! };
  }
  if (next.has(id)) next.delete(id); else next.add(id);
  return { selection: next, anchor: id };
}

/** Clique duplo no mesmo livro em até 450 ms abre o livro (o primeiro clique só o mostra no painel). */
export function isDoubleActivation(last: { id: string; at: number } | null, id: string, now: number, windowMs = 450): boolean {
  return Boolean(last && last.id === id && now - last.at >= 0 && now - last.at <= windowMs);
}
