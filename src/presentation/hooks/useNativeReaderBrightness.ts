import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Brightness from "expo-brightness";

/**
 * Brilho de tela do Reader no Android/iOS (extraído do ReaderScreen sem mudança de comportamento, onda B1).
 * Aplica o brilho escolhido quando "usar brilho do aparelho" está desligado, restaura o do sistema ao sair, ao ir para segundo
 * plano ou ao religar o automático. Operações em fila e com geração, para um resultado antigo não sobrescrever um novo.
 */
export function useNativeReaderBrightness({ bookId, ready, brightness, useSystemBrightness }: { bookId: string; ready: boolean; brightness: number; useSystemBrightness: boolean }) {
  const nativeBrightnessApplied = useRef(false);
  const originalBrightnessRef = useRef<number | null>(null);
  const nativeBrightnessOperation = useRef(0);
  const nativeBrightnessQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (Platform.OS === "web" || !ready) return;

    let disposed = false;
    const operation = ++nativeBrightnessOperation.current;
    const enqueue = (task: () => Promise<void>) => {
      const next = nativeBrightnessQueue.current.then(task, task);
      nativeBrightnessQueue.current = next.catch(() => undefined);
      return next;
    };

    const restore = async () => {
      if (disposed || nativeBrightnessOperation.current !== operation) return;
      if (!nativeBrightnessApplied.current || originalBrightnessRef.current === null) return;
      try {
        await Brightness.restoreSystemBrightnessAsync();
      } catch {
        return;
      }
      if (disposed || nativeBrightnessOperation.current !== operation) return;
      nativeBrightnessApplied.current = false;
      originalBrightnessRef.current = null;
    };

    const applyNativeBrightness = async () => {
      try {
        const available = await Brightness.isAvailableAsync();
        if (!available || disposed || nativeBrightnessOperation.current !== operation) return;

        if (!useSystemBrightness) {
          if (originalBrightnessRef.current === null) {
            const current = await Brightness.getBrightnessAsync();
            if (disposed || nativeBrightnessOperation.current !== operation) return;
            originalBrightnessRef.current = current;
          }
          await Brightness.setBrightnessAsync(Math.min(1, Math.max(0.2, brightness / 100)));
          if (disposed || nativeBrightnessOperation.current !== operation) return;
          nativeBrightnessApplied.current = true;
          return;
        }

        await restore();
      } catch {
        // Ignore native brightness failures and keep the reader usable.
      }
    };

    void enqueue(applyNativeBrightness);
    const subscription = AppState.addEventListener("change", state => {
      if (state === "background" || state === "inactive") void enqueue(restore);
      if (state === "active") void enqueue(applyNativeBrightness);
    });

    return () => {
      disposed = true;
      nativeBrightnessOperation.current++;
      subscription.remove();
      void enqueue(async () => Brightness.restoreSystemBrightnessAsync()).catch(() => undefined).finally(() => {
        if (nativeBrightnessOperation.current > operation) {
          nativeBrightnessApplied.current = false;
          originalBrightnessRef.current = null;
        }
      });
    };
  }, [bookId, ready, brightness, useSystemBrightness]);
}
