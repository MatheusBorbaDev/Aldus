import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { newLibraryId } from "@/src/domain/entities/libraryId";
import {
  activeReadingSeconds, focusMinutesLeft, focusSummaryText, readingActivity, readingBackground, readingForeground,
  ReadingSessionClock, ReadingSessionRecord, sessionRecord, startReadingClock,
} from "@/src/domain/reader/readingSession";
import { appDependencies } from "@/src/presentation/services/dependencies";

/** Preferência deste aparelho: mostrar o resumo ao terminar o foco (padrão: sim). */
export const FOCUS_SUMMARY_KEY = "@aldus/focus-summary.v1";
const FOCUS_TICK_MS = 15000;

/**
 * Sessão de leitura medida no Reader (Fase 2). Mede tempo ativo (primeiro plano, até 3 min após o último sinal de
 * leitura) e grava a sessão neste aparelho, na conta aberta, ao ir para segundo plano e ao sair do livro. Sem conta,
 * mede para o foco mas não grava. "Ler em foco por X min" começa uma sessão própria; ao atingir a meta (tempo ativo,
 * não relógio) ou ao encerrar, mostra um resumo que pode ser desligado. Não toca posição, documento nem progresso.
 */
export function useReadingSession({ bookId, format, ready, page }: {
  bookId: string; format: ReadingSessionRecord["format"]; ready: boolean; page: number;
}) {
  const clock = useRef<ReadingSessionClock | null>(null);
  const sessionId = useRef<string | null>(null);
  const owner = useRef<string | null>(null);
  const goal = useRef<number | null>(null);
  const [focusGoal, setFocusGoal] = useState<number | null>(null);
  const [focusLeft, setFocusLeft] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  // Última sessão de foco encerrada, para o cartão de foco (FASE 3, C). Só existe quando o resumo está ligado.
  const [lastFocus, setLastFocus] = useState<ReadingSessionRecord | null>(null);
  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const summaryEnabledRef = useRef(true);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => AsyncStorage.getItem(FOCUS_SUMMARY_KEY)).then(raw => {
      if (active && raw === "false") { summaryEnabledRef.current = false; setSummaryEnabled(false); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const record = useCallback((now: number) => clock.current && sessionId.current
    ? sessionRecord({ id: sessionId.current, bookId, format, clock: clock.current, now, focusGoalMinutes: goal.current })
    : null, [bookId, format]);

  const persist = useCallback((now: number) => {
    const value = record(now);
    // Conta trocada no meio: a sessão não é gravada em nenhuma das duas.
    if (value && owner.current && libraryAccountScope.userId === owner.current) {
      void appDependencies.readingSessions.save(owner.current, value).catch(() => undefined);
    }
    return value;
  }, [record]);

  const begin = useCallback((now: number, goalMinutes: number | null) => {
    clock.current = startReadingClock(now);
    sessionId.current = newLibraryId();
    owner.current = libraryAccountScope.userId;
    goal.current = goalMinutes;
    setFocusGoal(goalMinutes);
    setFocusLeft(goalMinutes);
  }, []);

  // Uma sessão por livro aberto e modo (EPUB, PDF Original ou Leitura Livre).
  useEffect(() => {
    if (!ready) return;
    begin(Date.now(), null);
    return () => {
      persist(Date.now());
      clock.current = null; sessionId.current = null; goal.current = null;
    };
  }, [ready, bookId, format, begin, persist]);

  useEffect(() => {
    if (clock.current && page > 0) clock.current = readingActivity(clock.current, Date.now());
  }, [page]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (!clock.current) return;
      const now = Date.now();
      if (state === "active") clock.current = readingForeground(clock.current, now);
      else { clock.current = readingBackground(clock.current, now); persist(now); }
    });
    return () => subscription.remove();
  }, [persist]);

  const finishFocus = useCallback((now: number) => {
    const value = persist(now);
    if (value && summaryEnabledRef.current) { setSummary(focusSummaryText(value)); setLastFocus(value); }
    begin(now, null);
  }, [begin, persist]);

  useEffect(() => {
    if (focusGoal === null) return;
    const timer = setInterval(() => {
      if (!clock.current || goal.current === null) return;
      const now = Date.now();
      const active = activeReadingSeconds(clock.current, now);
      if (active >= goal.current * 60) finishFocus(now);
      else setFocusLeft(focusMinutesLeft(goal.current, active));
    }, FOCUS_TICK_MS);
    return () => clearInterval(timer);
  }, [focusGoal, finishFocus]);

  /** Começa "Ler em foco": a sessão atual é gravada e a de foco começa do zero. Sem meta: só esconde os controles. */
  const startFocus = useCallback((minutes: number | null) => {
    if (!clock.current || minutes === null) return;
    const now = Date.now();
    persist(now);
    setSummary(null);
    begin(now, minutes);
  }, [begin, persist]);

  const endFocus = useCallback(() => {
    if (clock.current && goal.current !== null) finishFocus(Date.now());
  }, [finishFocus]);

  const setFocusSummaryEnabled = useCallback((value: boolean) => {
    summaryEnabledRef.current = value;
    setSummaryEnabled(value);
    if (!value) { setSummary(null); setLastFocus(null); }
    void Promise.resolve().then(() => AsyncStorage.setItem(FOCUS_SUMMARY_KEY, value ? "true" : "false")).catch(() => undefined);
  }, []);

  return {
    focusGoal, focusLeft, summary, summaryEnabled, lastFocus,
    startFocus, endFocus, dismissSummary: () => setSummary(null), setFocusSummaryEnabled, clearLastFocus: () => setLastFocus(null),
  };
}

/**
 * Só Android: abre a tela de "Não perturbe" do sistema. Não pede permissão nem muda a configuração; quem liga é a
 * pessoa. Tenta a tela pública (API 23+), depois a de "Não perturbe" e por fim a de Som, onde ela costuma ficar.
 */
export const DO_NOT_DISTURB_INTENTS = [
  "android.settings.ZEN_MODE_PRIORITY_SETTINGS",
  "android.settings.ZEN_MODE_SETTINGS",
  "android.settings.SOUND_SETTINGS",
] as const;

export async function openSystemDoNotDisturb(send: (action: string) => Promise<void> = action => Linking.sendIntent(action), platform: string = Platform.OS): Promise<boolean> {
  if (platform !== "android") return false;
  for (const action of DO_NOT_DISTURB_INTENTS) {
    try { await send(action); return true; } catch { /* próxima tela */ }
  }
  return false;
}
