import { throwIfAborted } from "./cancellation";

/**
 * Trabalho de CPU em fatias (preparação da Leitura Livre: plano de OCR, montagem, capítulos, validação, gravação).
 *
 * 18/11/2026, medido no Redmi do dono com um PDF de 1.144 páginas: fatias de 8 ms seguidas de `requestIdleCallback` (que espera o
 * "momento livre" do sistema, até 50 ms) deixavam a montagem em ~3 min 40 s, quase todo o tempo esperando. Durante a preparação a
 * tela só mostra o indicador (que gira no lado nativo) e o botão Cancelar, então a fatia sobe para 48 ms e a retomada é uma tarefa
 * nativa imediata (`setTimeout(0)`): o toque em Cancelar continua sendo atendido entre as fatias, em menos de um décimo de segundo.
 */
export const COOPERATIVE_SLICE_MS = 48;

/** CPU work crosses a host-task boundary, not RN's microtask-backed setImmediate (Cancel must get through between slices). */
export async function runCooperatively<T>(steps: Generator<unknown, T>, signal?: AbortSignal): Promise<T> {
  try {
    await yieldToHost(signal);
    let deadline = performance.now() + COOPERATIVE_SLICE_MS;
    for (;;) {
      throwIfAborted(signal);
      const next = steps.next();
      if (next.done) return next.value;
      if (performance.now() >= deadline) {
        await yieldToHost(signal);
        deadline = performance.now() + COOPERATIVE_SLICE_MS;
      }
    }
  } finally { steps.return(undefined as never); }
}

export function yieldToHost(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let release = () => {};
    const cleanup = () => { release(); signal?.removeEventListener("abort", abort); };
    const finish = () => { cleanup(); resolve(); };
    const abort = () => { cleanup(); try { throwIfAborted(signal); } catch (error) { reject(error); } };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    // A host task (timer), not idle time: scheduling CPU slices, not delaying/retrying an operation to hide a stall.
    const id = setTimeout(finish, 0);
    release = () => clearTimeout(id);
  });
}
