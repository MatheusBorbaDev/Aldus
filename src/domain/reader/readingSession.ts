/**
 * Sessão de leitura medida (Fase 2). Conta só tempo ativo: o app em primeiro plano e, no máximo, 3 minutos depois do
 * último sinal de leitura (abrir o livro, virar página, voltar ao app). Parado além disso = inatividade, não conta.
 * Em segundo plano não conta. Nada é estimado nem retroativo: sessões existem só a partir desta versão.
 * Funções puras com o relógio injetado; o hook do Reader só alimenta eventos.
 */
export const READING_INACTIVITY_MS = 3 * 60 * 1000;
/** Abrir e fechar sem ler não vira sessão. */
export const MIN_SAVED_SESSION_SECONDS = 10;
export const FOCUS_GOAL_MINUTES = [10, 15, 25, 45] as const;
export type FocusGoalMinutes = (typeof FOCUS_GOAL_MINUTES)[number];

export interface ReadingSessionClock {
  startedAt: number;
  /** Tempo ativo já creditado, em ms. */
  activeMs: number;
  lastActivityAt: number;
  /** Até onde o tempo já foi creditado (nunca passa de lastActivityAt + inatividade). */
  countedUntil: number;
  foreground: boolean;
}

export function startReadingClock(now: number): ReadingSessionClock {
  return { startedAt: now, activeMs: 0, lastActivityAt: now, countedUntil: now, foreground: true };
}

function credit(clock: ReadingSessionClock, now: number): ReadingSessionClock {
  if (!clock.foreground) return clock;
  const end = Math.min(now, clock.lastActivityAt + READING_INACTIVITY_MS);
  return end > clock.countedUntil ? { ...clock, activeMs: clock.activeMs + (end - clock.countedUntil), countedUntil: end } : clock;
}

/** Virar página (ou outro sinal de leitura). Depois de uma pausa por inatividade, o intervalo parado não é creditado. */
export function readingActivity(clock: ReadingSessionClock, now: number): ReadingSessionClock {
  if (!clock.foreground) return clock;
  const credited = credit(clock, now);
  return { ...credited, lastActivityAt: now, countedUntil: Math.max(credited.countedUntil, now) };
}

export function readingBackground(clock: ReadingSessionClock, now: number): ReadingSessionClock {
  return clock.foreground ? { ...credit(clock, now), foreground: false } : clock;
}

/** Voltar ao app conta como sinal de leitura; o tempo fora não é creditado. */
export function readingForeground(clock: ReadingSessionClock, now: number): ReadingSessionClock {
  return clock.foreground ? readingActivity(clock, now) : { ...clock, foreground: true, lastActivityAt: now, countedUntil: now };
}

export function activeReadingSeconds(clock: ReadingSessionClock, now: number): number {
  return Math.floor(credit(clock, now).activeMs / 1000);
}

/** true quando o leitor está parado há mais de 3 minutos (ou fora do app). */
export function readingIdle(clock: ReadingSessionClock, now: number): boolean {
  return !clock.foreground || now - clock.lastActivityAt > READING_INACTIVITY_MS;
}

export interface ReadingSessionRecord {
  id: string;
  bookId: string;
  format: "epub" | "pdf" | "reflow";
  startedAt: number;
  endedAt: number;
  activeSeconds: number;
  /** Meta de "Ler em foco" escolhida nesta sessão, ou null. */
  focusGoalMinutes: number | null;
  /** Meta atingida em tempo ativo medido; null sem meta. */
  focusGoalReached: boolean | null;
}

export function sessionRecord(input: {
  id: string; bookId: string; format: ReadingSessionRecord["format"]; clock: ReadingSessionClock; now: number; focusGoalMinutes: number | null;
}): ReadingSessionRecord {
  const activeSeconds = activeReadingSeconds(input.clock, input.now);
  return {
    id: input.id, bookId: input.bookId, format: input.format, startedAt: input.clock.startedAt, endedAt: input.now, activeSeconds,
    focusGoalMinutes: input.focusGoalMinutes,
    focusGoalReached: input.focusGoalMinutes === null ? null : activeSeconds >= input.focusGoalMinutes * 60,
  };
}

/** Minutos de foco que faltam (arredondado para cima), ou 0. */
export function focusMinutesLeft(goalMinutes: number, activeSeconds: number): number {
  return Math.max(0, Math.ceil((goalMinutes * 60 - activeSeconds) / 60));
}

/** Resumo em pt-BR só com medidas reais: tempo ativo e tempo com o livro aberto. Sem comparação, sem sequência. */
export function focusSummaryText(record: ReadingSessionRecord): string {
  const active = Math.floor(record.activeSeconds / 60);
  const open = Math.max(active, Math.floor((record.endedAt - record.startedAt) / 60000));
  const activeText = active < 1 ? "menos de 1 min" : `${active} min`;
  const head = record.focusGoalReached ? "Foco concluído" : "Sessão de foco encerrada";
  return `${head}: ${activeText} de leitura ativa${open > active ? ` em ${open} min com o livro aberto` : ""}.`;
}

export function isReadingSessionRecord(value: unknown): value is ReadingSessionRecord {
  const v = value as ReadingSessionRecord;
  return !!v && typeof v === "object" && typeof v.id === "string" && typeof v.bookId === "string" && ["epub", "pdf", "reflow"].includes(v.format)
    && Number.isFinite(v.startedAt) && Number.isFinite(v.endedAt) && v.endedAt >= v.startedAt
    && Number.isInteger(v.activeSeconds) && v.activeSeconds >= 0 && v.activeSeconds * 1000 <= v.endedAt - v.startedAt + 1000
    && (v.focusGoalMinutes === null || Number.isInteger(v.focusGoalMinutes)) && (v.focusGoalReached === null || typeof v.focusGoalReached === "boolean");
}
