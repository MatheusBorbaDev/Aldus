/**
 * Tempo de leitura (onda B4; por página e no livro desde 23/11/2026), a partir do ritmo medido do próprio leitor neste aparelho.
 * Amostra = segundos entre duas páginas vizinhas lidas para a frente. Intervalos muito curtos (folheando) ou muito longos (pausa)
 * não contam. Sem amostras suficientes não há estimativa (null): nunca um valor padrão inventado.
 */
export const PACE_MIN_SECONDS = 3;
export const PACE_MAX_SECONDS = 10 * 60;
export const PACE_MIN_SAMPLES = 5;
export const PACE_MAX_SAMPLES = 30;

export interface PageTurn { page: number; at: number }

/** Amostra válida da passagem `previous → next`, ou null. */
export function paceSample(previous: PageTurn | null, next: PageTurn): number | null {
  if (!previous || next.page !== previous.page + 1) return null;
  const seconds = (next.at - previous.at) / 1000;
  return seconds >= PACE_MIN_SECONDS && seconds <= PACE_MAX_SECONDS ? seconds : null;
}

/** Acrescenta e mantém só as amostras mais recentes. */
export function addPaceSample(samples: number[], sample: number): number[] {
  return [...samples, sample].slice(-PACE_MAX_SAMPLES);
}

/** Segundos por página (mediana, resistente a uma pausa isolada); null abaixo do mínimo de amostras. */
export function secondsPerPage(samples: number[]): number | null {
  const valid = samples.filter(value => Number.isFinite(value) && value >= PACE_MIN_SECONDS && value <= PACE_MAX_SECONDS).sort((a, b) => a - b);
  if (valid.length < PACE_MIN_SAMPLES) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

/** Páginas que faltam até o fim do livro, incluindo a atual; null sem posição. */
export function pagesLeftInBook(page: number, totalPages: number): number | null {
  if (totalPages < 1 || page < 1) return null;
  return Math.max(0, totalPages - page + 1);
}

/** Texto curto: "menos de 1 min", "≈ 6 min", "≈ 1 h 5 min". */
export function formatTimeLeft(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `≈ ${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return rest ? `≈ ${hours} h ${rest} min` : `≈ ${hours} h`;
}

/** Ritmo por página: "≈ 40 s" abaixo de um minuto, "≈ 2 min" acima. */
export function formatSecondsPerPage(seconds: number): string {
  return seconds < 59.5 ? `≈ ${Math.max(1, Math.round(seconds))} s` : `≈ ${Math.round(seconds / 60)} min`;
}

/**
 * Rótulo do rodapé (23/11/2026, pedido do dono: o tempo por capítulo dependia da divisão de capítulos do livro, que nem sempre é
 * correta): o ritmo por página e o tempo para terminar o livro. null sem ritmo medido ou sem posição; nunca um valor inventado.
 */
export function bookTimeLeftLabel(samples: number[], page: number, totalPages: number): string | null {
  const pace = secondsPerPage(samples), pages = pagesLeftInBook(page, totalPages);
  if (pace === null || pages === null || pages < 1) return null;
  return `${formatSecondsPerPage(pace)} por página · ${formatTimeLeft(pace * pages)} no livro`;
}
