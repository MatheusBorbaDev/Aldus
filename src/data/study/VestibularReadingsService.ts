import { parseReadingLists, parseVestibulares, validSuggestion, Vestibular, VestibularContractError, VestibularReadingList, VestibularSuggestion } from "@/src/domain/study/vestibularReadings";

/**
 * Leituras de vestibular (25/11/2026): listas públicas no Supabase (tabelas `vestibulares` e `vestibular_reading_lists`, leitura sem
 * conta), com cópia no aparelho para abrir sem internet. Informação de edital, não dado pessoal: a cópia é por aparelho, não por conta.
 * A escolha do vestibular fica só no aparelho. Sugestões vão pela função `vestibular_suggest` (exige conta, limite diário no servidor).
 */
export interface VestibularStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export interface VestibularRemote {
  readVestibulares(): Promise<unknown>;
  readLists(): Promise<unknown>;
  suggest(vestibularId: string | null, message: string): Promise<unknown>;
}
export interface VestibularSnapshot { vestibulares: Vestibular[]; lists: VestibularReadingList[]; savedAt: string }
export type VestibularReadResult =
  | { source: "server"; snapshot: VestibularSnapshot }
  /** Sem rede ou servidor fora: a última cópia, com a data em que foi salva. */
  | { source: "copy"; snapshot: VestibularSnapshot }
  | { source: "unavailable"; snapshot: null };

export const VESTIBULAR_CACHE_KEY = "@aldus/vestibular-readings.v1";
export const VESTIBULAR_CHOICE_KEY = "@aldus/vestibular-choice.v1";

export class VestibularSuggestionError extends Error {}
const suggestionMessages: Record<string, string> = {
  account: "Entre na sua conta para enviar sugestões.",
  rate: "Você já enviou 5 sugestões hoje. Tente de novo amanhã.",
  message: "Escreva entre 5 e 600 caracteres.",
  vestibular: "Esse vestibular não está na lista.",
};

export class VestibularReadingsService {
  constructor(private readonly remote: VestibularRemote | null, private readonly storage: VestibularStorage, private readonly now = () => new Date()) {}

  async read(): Promise<VestibularReadResult> {
    if (this.remote) {
      try {
        const [vestibulares, lists] = await Promise.all([this.remote.readVestibulares(), this.remote.readLists()]);
        const snapshot = { vestibulares: parseVestibulares(vestibulares), lists: parseReadingLists(lists), savedAt: this.now().toISOString() };
        // Falha ao guardar a cópia não esconde a lista que acabou de chegar.
        await this.storage.setItem(VESTIBULAR_CACHE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
        return { source: "server", snapshot };
      } catch { /* cai para a cópia */ }
    }
    const copy = await this.readCopy();
    return copy ? { source: "copy", snapshot: copy } : { source: "unavailable", snapshot: null };
  }

  private async readCopy(): Promise<VestibularSnapshot | null> {
    try {
      const raw = await this.storage.getItem(VESTIBULAR_CACHE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (typeof value?.savedAt !== "string") return null;
      // A cópia passa pela mesma validação do servidor (formato interno igual ao já validado).
      const vestibulares = parseVestibulares(value.vestibulares.map((v: Vestibular) => ({ id: v.id, name: v.name, institution: v.institution, official_url: v.officialUrl })));
      const lists = parseReadingLists(value.lists.map((l: VestibularReadingList) => ({ vestibular_id: l.vestibularId, exam_year: l.examYear, source_url: l.sourceUrl, books: l.books })));
      return { vestibulares, lists, savedAt: value.savedAt };
    } catch { return null; }
  }

  async readChoice(): Promise<string | null> {
    try { const value = await this.storage.getItem(VESTIBULAR_CHOICE_KEY); return value && /^[a-z0-9-]{2,40}$/.test(value) ? value : null; }
    catch { return null; }
  }
  async saveChoice(id: string): Promise<void> { await this.storage.setItem(VESTIBULAR_CHOICE_KEY, id).catch(() => undefined); }

  async suggest(input: VestibularSuggestion): Promise<void> {
    let valid: VestibularSuggestion;
    try { valid = validSuggestion(input); } catch (error) { throw new VestibularSuggestionError(error instanceof VestibularContractError ? error.message : "Sugestão inválida."); }
    if (!this.remote) throw new VestibularSuggestionError("Sem conexão com o servidor do Aldus.");
    let answer: any;
    try { answer = await this.remote.suggest(valid.vestibularId, valid.message); }
    catch { throw new VestibularSuggestionError("Não foi possível enviar agora. Confira a internet e tente de novo."); }
    if (!answer?.ok) throw new VestibularSuggestionError(suggestionMessages[answer?.code] ?? "Não foi possível enviar a sugestão.");
  }
}
