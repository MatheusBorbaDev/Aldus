/**
 * Sincronismo do PC (23/11/2026): com o site aberto e visível, a biblioteca busca mudanças de tempos em tempos (ex.: o que foi
 * lido no celular) sem esperar a aba perder e recuperar o foco. Aba oculta ou sem rede não consulta nada. O Android continua só
 * com abrir, voltar ao app e reconectar (sem consulta periódica em segundo plano).
 */
export const WEB_SYNC_INTERVAL_MS = 90_000;

interface PeriodicEnv {
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  document?: { visibilityState?: string };
  navigator?: { onLine?: boolean };
}

const browserEnv = (): PeriodicEnv => ({
  setInterval: (handler, ms) => globalThis.setInterval(handler, ms),
  clearInterval: id => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  document: typeof document === "undefined" ? undefined : document,
  navigator: typeof navigator === "undefined" ? undefined : navigator,
});

/** Agenda `sync` a cada intervalo enquanto a página está visível e online. Devolve a função que para. */
export function startWebPeriodicSync(sync: () => void, env: PeriodicEnv = browserEnv(), intervalMs = WEB_SYNC_INTERVAL_MS): () => void {
  if (!env.document) return () => undefined;
  const timer = env.setInterval(() => {
    if (env.document?.visibilityState !== "visible") return;
    if (env.navigator?.onLine === false) return;
    sync();
  }, intervalMs);
  return () => env.clearInterval(timer);
}
