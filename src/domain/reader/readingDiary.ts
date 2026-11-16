import { ReadingSessionRecord } from "@/src/domain/reader/readingSession";

/**
 * Diário de leitura (FASE 3, B1). Só sessões medidas pela FASE 2 (tempo ativo, neste aparelho, por conta): nada retroativo,
 * nada estimado. Dias sem sessão não aparecem; não há "dias seguidos", meta diária, ranking ou comparação.
 */
export interface DiaryBookEntry { bookId: string; title: string; seconds: number; sessions: number }
export interface DiaryDay { day: string; seconds: number; books: DiaryBookEntry[] }

export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Agrupa por dia local de início da sessão; livros e dias do mais recente para o mais antigo. Livro removido aparece como tal. */
export function buildDiary(sessions: ReadingSessionRecord[], titles: Map<string, string>): DiaryDay[] {
  const days = new Map<string, Map<string, DiaryBookEntry & { last: number }>>();
  for (const session of sessions) {
    if (!Number.isInteger(session.activeSeconds) || session.activeSeconds <= 0) continue;
    const key = localDayKey(session.startedAt);
    const books = days.get(key) ?? new Map();
    const entry = books.get(session.bookId) ?? { bookId: session.bookId, title: titles.get(session.bookId) ?? "Livro removido da biblioteca", seconds: 0, sessions: 0, last: 0 };
    entry.seconds += session.activeSeconds; entry.sessions += 1; entry.last = Math.max(entry.last, session.startedAt);
    books.set(session.bookId, entry); days.set(key, books);
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, books]) => {
    const list = [...books.values()].sort((a, b) => b.last - a.last).map(({ last: _last, ...entry }) => entry);
    return { day, seconds: list.reduce((sum, entry) => sum + entry.seconds, 0), books: list };
  });
}

export function formatActiveTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${hours} h`;
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "hoje", "ontem" ou "segunda-feira, 10 de novembro" (sem Intl: Hermes). */
export function diaryDayLabel(day: string, today: string, yesterday: string): string {
  if (day === today) return "Hoje";
  if (day === yesterday) return "Ontem";
  const [year, month, date] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, date).getDay()];
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${date} de ${MONTHS[month - 1]}${String(year) === today.slice(0, 4) ? "" : ` de ${year}`}`;
}
