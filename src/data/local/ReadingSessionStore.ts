import AsyncStorage from "@react-native-async-storage/async-storage";
import { isReadingSessionRecord, MIN_SAVED_SESSION_SECONDS, ReadingSessionRecord } from "@/src/domain/reader/readingSession";

/** Sessões medidas (Fase 2), só neste aparelho e por conta: A e B nunca leem as sessões uma da outra. Não sincroniza. */
export const READING_SESSIONS_KEY_PREFIX = "@aldus/reading-sessions.v1:";
export const readingSessionsKey = (userId: string) => READING_SESSIONS_KEY_PREFIX + encodeURIComponent(userId);
export const MAX_STORED_READING_SESSIONS = 2000;

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class ReadingSessionCorruptError extends Error {
  constructor() { super("Histórico de sessões ilegível; preservado sem gravar por cima."); this.name = "ReadingSessionCorruptError"; }
}

function parse(raw: string | null): ReadingSessionRecord[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new ReadingSessionCorruptError(); }
  const value = parsed as { version?: unknown; sessions?: unknown };
  if (value?.version !== 1 || !Array.isArray(value.sessions)) throw new ReadingSessionCorruptError();
  return value.sessions.filter(isReadingSessionRecord);
}

/**
 * Grava por id (a mesma sessão é atualizada ao ir para segundo plano e ao sair do livro). Sessões com menos de
 * 10 s ativos não são gravadas. Histórico ilegível é preservado: a gravação falha em vez de apagar o que existe.
 * Gravações em fila, uma por vez.
 */
export class ReadingSessionStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  async list(userId: string): Promise<ReadingSessionRecord[]> {
    return parse(await this.storage.getItem(readingSessionsKey(userId)));
  }

  save(userId: string, record: ReadingSessionRecord): Promise<boolean> {
    const run = this.queue.then(async () => {
      if (!isReadingSessionRecord(record) || record.activeSeconds < MIN_SAVED_SESSION_SECONDS) return false;
      const key = readingSessionsKey(userId);
      const sessions = parse(await this.storage.getItem(key)).filter(item => item.id !== record.id);
      sessions.push(record);
      sessions.sort((a, b) => a.startedAt - b.startedAt);
      await this.storage.setItem(key, JSON.stringify({ version: 1, sessions: sessions.slice(-MAX_STORED_READING_SESSIONS) }));
      return true;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
