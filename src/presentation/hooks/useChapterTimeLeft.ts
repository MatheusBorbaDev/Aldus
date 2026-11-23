import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addPaceSample, bookTimeLeftLabel, PageTurn, paceSample } from "@/src/domain/reader/readingPace";

/** Ritmo deste aparelho (segundos por página, últimas amostras). Prefixo legado `@kindle/` preservado. */
export const READING_PACE_KEY = "@kindle/reading-pace.v1";

/**
 * Ritmo por página e tempo para terminar o livro (onda B4; até 23/11/2026 era o tempo no capítulo, que dependia da divisão de
 * capítulos do livro). Mede o ritmo nas viradas de página para a frente enquanto o livro está aberto e
 * guarda as amostras neste aparelho. Não muda posição, documento nem progresso; só produz um rótulo (ou null).
 */
export function useReadingTimeLeft({ enabled, page, totalPages }: { enabled: boolean; page: number; totalPages: number }): string | null {
  const [samples, setSamples] = useState<number[]>([]);
  const loaded = useRef(false);
  const lastTurn = useRef<PageTurn | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => AsyncStorage.getItem(READING_PACE_KEY)).then(raw => {
      if (!active) return;
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setSamples(current => [...parsed.filter((value: unknown) => typeof value === "number"), ...current].slice(-30));
    }).catch(() => undefined).finally(() => { loaded.current = true; });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!enabled || page < 1) { lastTurn.current = null; return; }
    const turn = { page, at: Date.now() };
    const sample = paceSample(lastTurn.current, turn);
    lastTurn.current = turn;
    if (sample === null) return;
    setSamples(current => {
      const next = addPaceSample(current, sample);
      // Preferência de conveniência: se a gravação falhar, a estimativa só recomeça do zero no próximo livro aberto.
      if (loaded.current) void Promise.resolve().then(() => AsyncStorage.setItem(READING_PACE_KEY, JSON.stringify(next))).catch(() => undefined);
      return next;
    });
  }, [enabled, page]);
  return useMemo(() => enabled ? bookTimeLeftLabel(samples, page, totalPages) : null, [enabled, samples, page, totalPages]);
}
