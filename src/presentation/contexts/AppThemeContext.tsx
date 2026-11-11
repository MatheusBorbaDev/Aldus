import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { AppThemeMode, appThemeTokens, AppThemePalette, resolveAppThemeName } from "@/src/theme/tokens";
import { latestWriteTracker } from "@/src/core/utils/latestWrite";

interface AppThemeContextValue {
  mode: AppThemeMode;
  resolvedTheme: "light" | "dark";
  palette: AppThemePalette;
  setMode: (nextMode: AppThemeMode) => Promise<void>;
  /** Mensagem quando a última gravação do tema falhou; null quando salvou. */
  saveError?: string | null;
}

const APP_THEME_STORAGE_KEY = "@kindle/appTheme";
export const APP_THEME_SAVE_ERROR = "Não foi possível salvar o tema neste aparelho. Ele vale até você fechar o app.";
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const resolvedSystemScheme = systemScheme === "light" || systemScheme === "dark" ? systemScheme : null;
  const [mode, setModeState] = useState<AppThemeMode>("system");
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const trackSave = useMemo(() => latestWriteTracker(failed => setSaveError(failed ? APP_THEME_SAVE_ERROR : null)), []);
  // Leitura falhou: o padrão "system" não sobrescreve o tema salvo; só uma escolha do usuário grava (onda 5).
  const skipUnchangedSave = useRef(false);

  useEffect(() => {
    let disposed = false;
    void AsyncStorage.getItem(APP_THEME_STORAGE_KEY).then((stored) => {
      if (disposed) return;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
      setReady(true);
    }).catch(() => {
      if (!disposed) { skipUnchangedSave.current = true; setReady(true); }
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipUnchangedSave.current) { skipUnchangedSave.current = false; return; }
    trackSave(AsyncStorage.setItem(APP_THEME_STORAGE_KEY, mode));
  }, [mode, ready, trackSave]);

  const resolvedTheme = useMemo(() => resolveAppThemeName(mode, resolvedSystemScheme), [mode, resolvedSystemScheme]);
  const palette = useMemo(() => appThemeTokens[resolvedTheme], [resolvedTheme]);

  const value = useMemo<AppThemeContextValue>(() => ({
    mode,
    resolvedTheme,
    palette,
    setMode: async (nextMode: AppThemeMode) => {
      setModeState(nextMode);
    },
    saveError,
  }), [mode, palette, resolvedTheme, saveError]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error("useAppTheme must be used within AppThemeProvider");
  return value;
}

/** Tema resolvido do app ou null fora do provedor (o Reader usa para o tema "Automático" sem exigir o provedor). */
export function useResolvedAppTheme(): "light" | "dark" | null {
  return useContext(AppThemeContext)?.resolvedTheme ?? null;
}
