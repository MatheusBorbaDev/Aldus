import AsyncStorage from "@react-native-async-storage/async-storage";
import { isMilestonePlan, MilestonePlan } from "@/src/domain/reader/readingMilestones";

/** Marcos por livro (FASE 5b), só neste aparelho e por conta. Não sincroniza. */
export const READING_MILESTONES_KEY_PREFIX = "@aldus/reading-milestones.v1:";
export const readingMilestonesKey = (userId: string) => READING_MILESTONES_KEY_PREFIX + encodeURIComponent(userId);

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function parse(raw: string | null): Record<string, MilestonePlan> {
  if (!raw) return {};
  let value: { version?: unknown; plans?: unknown };
  try { value = JSON.parse(raw); } catch { throw new Error("Marcos ilegíveis; preservados sem gravar por cima."); }
  if (value?.version !== 1 || !value.plans || typeof value.plans !== "object" || Array.isArray(value.plans)) throw new Error("Marcos ilegíveis; preservados sem gravar por cima.");
  const plans: Record<string, MilestonePlan> = {};
  for (const [bookId, plan] of Object.entries(value.plans as Record<string, unknown>)) if (bookId && isMilestonePlan(plan)) plans[bookId] = plan;
  return plans;
}

export class ReadingMilestoneStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  async get(userId: string, bookId: string): Promise<MilestonePlan | null> {
    return parse(await this.storage.getItem(readingMilestonesKey(userId)))[bookId] ?? null;
  }

  /** null remove os marcos do livro. Gravações em fila; histórico ilegível não é sobrescrito. */
  set(userId: string, bookId: string, plan: MilestonePlan | null): Promise<void> {
    const run = this.queue.then(async () => {
      if (plan && !isMilestonePlan(plan)) throw new Error("Marcos inválidos.");
      const key = readingMilestonesKey(userId);
      const plans = parse(await this.storage.getItem(key));
      if (plan) plans[bookId] = plan; else delete plans[bookId];
      await this.storage.setItem(key, JSON.stringify({ version: 1, plans }));
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
