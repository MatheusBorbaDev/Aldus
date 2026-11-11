/**
 * Tempo restante no capítulo (onda B4), a partir do ritmo medido do próprio leitor neste aparelho.
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

/**
 * Páginas que faltam até o próximo capítulo começar (incluindo a atual), a partir das páginas de início medidas pelo documento.
 * null quando o capítulo atual não está nas posições conhecidas.
 */
export function pagesLeftInChapter(locations: Array<{ chapterIndex: number; pageNumber: number }>, chapterIndex: number, page: number, totalPages: number): number | null {
  if (!locations.length || totalPages < 1 || page < 1) return null;
  const sorted = [...locations].sort((a, b) => a.pageNumber - b.pageNumber);
  const current = sorted.findIndex(item => item.chapterIndex === chapterIndex);
  if (current < 0) return null;
  const nextStart = sorted.slice(current + 1).find(item => item.pageNumber > page)?.pageNumber ?? totalPages + 1;
  return Math.max(0, nextStart - page);
}

/** Texto curto: "menos de 1 min", "≈ 6 min", "≈ 1 h 5 min". */
export function formatTimeLeft(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `≈ ${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return rest ? `≈ ${hours} h ${rest} min` : `≈ ${hours} h`;
}

/** Rótulo do rodapé ou null quando falta ritmo medido ou posição do capítulo. */
export function chapterTimeLeftLabel(samples: number[], locations: Array<{ chapterIndex: number; pageNumber: number }>, chapterIndex: number, page: number, totalPages: number): string | null {
  const pace = secondsPerPage(samples), pages = pagesLeftInChapter(locations, chapterIndex, page, totalPages);
  if (pace === null || pages === null || pages < 1) return null;
  return `${formatTimeLeft(pace * pages)} neste capítulo`;
}
