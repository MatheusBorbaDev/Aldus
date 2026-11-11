import { useCallback, useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";
import { splitForSpeech } from "@/src/domain/reader/speechText";

/**
 * Leitura em voz alta com a voz do sistema (onda C1; offline, nada sai do aparelho). Fala os trechos em sequência; uma nova
 * leitura ou "Parar" cancela a anterior (geração), e sair do Reader para a fala. Não vira páginas nem toca posição/progresso.
 */
export function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    setSpeaking(false);
    void Promise.resolve().then(() => Speech.stop()).catch(() => undefined);
  }, []);
  const start = useCallback((text: string, language?: string | null) => {
    const chunks = splitForSpeech(text);
    if (!chunks.length) { setError("Não há texto para ler nesta parte do livro."); return; }
    const current = ++generation.current;
    setError(null); setSpeaking(true);
    void Promise.resolve().then(() => Speech.stop()).catch(() => undefined).then(() => {
      const speakAt = (index: number) => {
        if (generation.current !== current) return;
        if (index >= chunks.length) { setSpeaking(false); return; }
        Speech.speak(chunks[index], {
          language: language ?? undefined,
          onDone: () => speakAt(index + 1),
          onStopped: () => { if (generation.current === current) setSpeaking(false); },
          onError: () => { if (generation.current === current) { setSpeaking(false); setError("A voz do aparelho não conseguiu ler este trecho."); } },
        });
      };
      speakAt(0);
    });
  }, []);
  useEffect(() => () => { generation.current++; void Promise.resolve().then(() => Speech.stop()).catch(() => undefined); }, []);
  return { speaking, error, start, stop };
}
