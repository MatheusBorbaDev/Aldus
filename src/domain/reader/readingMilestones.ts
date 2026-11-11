/**
 * Marcos de leitura locais (FASE 5b). A pessoa divide o livro em 2–6 marcos iguais e, se quiser, um prazo; o app mostra
 * "marco 2 de 3" pelo progresso deste arquivo e gera um cronograma em texto para compartilhar. Sem servidor, comentários,
 * feed, chat ou ranking; o cronograma nunca leva o arquivo do livro. Porcentagens são da edição de quem planejou.
 */
export const MILESTONE_COUNTS = [2, 3, 4, 6] as const;
export const MILESTONE_DEADLINES = [
  { id: "none", label: "Sem prazo", days: null },
  { id: "1w", label: "1 semana", days: 7 },
  { id: "2w", label: "2 semanas", days: 14 },
  { id: "1m", label: "1 mês", days: 30 },
] as const;
export const MILESTONE_DRM_NOTICE = "Cada pessoa lê a própria cópia do livro. Arquivos com DRM de loja podem não abrir no Aldus.";

export interface MilestonePlan {
  version: 1;
  count: number;
  /** Datas locais AAAA-MM-DD. */
  startDate: string;
  endDate: string | null;
}

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));

export function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function createMilestonePlan(count: number, deadlineDays: number | null, today: Date): MilestonePlan {
  if (!Number.isInteger(count) || count < 2 || count > 6) throw new Error("Escolha de 2 a 6 marcos.");
  const end = deadlineDays === null ? null : new Date(today.getFullYear(), today.getMonth(), today.getDate() + deadlineDays);
  return { version: 1, count, startDate: localIsoDate(today), endDate: end ? localIsoDate(end) : null };
}

export function isMilestonePlan(value: unknown): value is MilestonePlan {
  const v = value as MilestonePlan;
  return !!v && v.version === 1 && Number.isInteger(v.count) && v.count >= 2 && v.count <= 6 && typeof v.startDate === "string" && isoDay(v.startDate)
    && (v.endDate === null || (typeof v.endDate === "string" && isoDay(v.endDate) && v.endDate >= v.startDate));
}

/** Fração do livro ao fim de cada marco. */
export function milestoneThresholds(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) / count);
}

/** Data de cada marco (espaçada igualmente até o prazo) ou null sem prazo. */
export function milestoneDates(plan: MilestonePlan): Array<string | null> {
  if (!plan.endDate) return Array(plan.count).fill(null);
  const start = Date.parse(plan.startDate + "T00:00:00Z"), end = Date.parse(plan.endDate + "T00:00:00Z");
  return milestoneThresholds(plan.count).map(fraction => new Date(start + Math.round(((end - start) / DAY) * fraction) * DAY).toISOString().slice(0, 10));
}

/** Marcos alcançados pelo progresso atual (0..1) e o próximo; `next` null quando todos foram alcançados. */
export function milestoneStatus(plan: MilestonePlan, progress: number): { reached: number; next: number | null; count: number } {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const reached = milestoneThresholds(plan.count).filter(threshold => value + 1e-9 >= threshold).length;
  return { reached, next: reached >= plan.count ? null : reached + 1, count: plan.count };
}

export function milestoneLabel(plan: MilestonePlan, progress: number): string {
  const status = milestoneStatus(plan, progress);
  return status.next === null ? "marcos concluídos" : `marco ${status.next} de ${status.count}`;
}

const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Cronograma em texto simples para compartilhar. Sem progresso pessoal, sem link e sem arquivo. */
export function milestoneScheduleText(plan: MilestonePlan, title: string): string {
  const dates = milestoneDates(plan);
  const lines = milestoneThresholds(plan.count).map((fraction, i) =>
    `Marco ${i + 1} de ${plan.count}: até ${Math.round(fraction * 100)}% do livro${dates[i] ? ` · até ${brDate(dates[i]!)}` : ""}`);
  return [`Cronograma de leitura — «${title}»`, ...lines, MILESTONE_DRM_NOTICE].join("\n");
}
