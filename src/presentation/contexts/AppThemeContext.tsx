import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { AppPaletteName, appPalettes, AppThemeMode, AppThemePalette, isAppPaletteName, resolveAppThemeName } from "@/src/theme/tokens";
import { latestWriteTracker } from "@/src/core/utils/latestWrite";

interface AppThemeContextValue {
  mode: AppThemeMode;
  resolvedTheme: "light" | "dark";
  palette: AppThemePalette;
  setMode: (nextMode: AppThemeMode) => Promise<void>;
  /** Paleta do app: Clássico ou uma das Moderno. Vale para o aparelho, como o modo claro/escuro. */
  paletteName: AppPaletteName;
  setPaletteName: (next: AppPaletteName) => void;
  /** Mensagem quando a última gravação do tema falhou; null quando salvou. */
  saveError?: string | null;
}

const APP_THEME_STORAGE_KEY = "@kindle/appTheme";
/**
 * 25/11/2026 (dono: "o aldus tá abrindo direto no tema verde, quero que ele abra no tema original"): o padrão passa a ser o Clássico
 * claro. Antes o padrão "system" era gravado sozinho na primeira abertura; por isso "system" só vale se a pessoa o escolheu de fato
 * (marca abaixo, gravada só por escolha). Claro ou escuro escolhidos continuam valendo.
 */
export const APP_THEME_CHOSEN_KEY = "@aldus/app-theme-chosen.v1";
/** Chave nova (16/11/2026); as legadas `@kindle/*` não são reaproveitadas. */
export const APP_PALETTE_STORAGE_KEY = "@aldus/app-palette.v1";
export const APP_THEME_SAVE_ERROR = "Não foi possível salvar o tema neste aparelho. Ele vale até você fechar o app.";
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const resolvedSystemScheme = systemScheme === "light" || systemScheme === "dark" ? systemScheme : null;
  const [mode, setModeState] = useState<AppThemeMode>("light");
  const [ready, setReady] = useState(false);
  const [paletteName, setPaletteState] = useState<AppPaletteName>("classic");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [paletteSaveError, setPaletteSaveError] = useState<string | null>(null);
  const trackSave = useMemo(() => latestWriteTracker(failed => setSaveError(failed ? APP_THEME_SAVE_ERROR : null)), []);
  const trackPaletteSave = useMemo(() => latestWriteTracker(failed => setPaletteSaveError(failed ? APP_THEME_SAVE_ERROR : null)), []);
  // A paleta só é gravada por escolha explícita; ler e falhar nunca grava o padrão por cima.
  const paletteTouched = useRef(false);
  // Leitura falhou: o padrão não sobrescreve o tema salvo; só uma escolha do usuário grava (onda 5).
  const skipUnchangedSave = useRef(false);

  useEffect(() => {
    let disposed = false;
    void Promise.all([AsyncStorage.getItem(APP_THEME_STORAGE_KEY), AsyncStorage.getItem(APP_THEME_CHOSEN_KEY).catch(() => null)]).then(([stored, chosen]) => {
      if (disposed) return;
      if (stored === "light" || stored === "dark" || (stored === "system" && chosen === "1")) {
        setModeState(stored);
      }
      setReady(true);
    }).catch(() => {
      if (!disposed) { skipUnchangedSave.current = true; setReady(true); }
    });

    void AsyncStorage.getItem(APP_PALETTE_STORAGE_KEY).then((stored) => {
      if (!disposed && !paletteTouched.current && isAppPaletteName(stored)) setPaletteState(stored);
    }).catch(() => undefined);

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
  const palette = useMemo(() => appPalettes[paletteName][resolvedTheme], [paletteName, resolvedTheme]);

  const value = useMemo<AppThemeContextValue>(() => ({
    mode,
    resolvedTheme,
    palette,
    setMode: async (nextMode: AppThemeMode) => {
      setModeState(nextMode);
      void AsyncStorage.setItem(APP_THEME_CHOSEN_KEY, "1").catch(() => undefined);
    },
    paletteName,
    setPaletteName: (next: AppPaletteName) => {
      if (!isAppPaletteName(next)) return;
      paletteTouched.current = true;
      setPaletteState(next);
      trackPaletteSave(AsyncStorage.setItem(APP_PALETTE_STORAGE_KEY, next));
    },
    saveError: saveError ?? paletteSaveError,
  }), [mode, palette, paletteName, paletteSaveError, resolvedTheme, saveError, trackPaletteSave]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error("useAppTheme must be used within AppThemeProvider");
  return value;
}

/** Paleta do app ou null fora do provedor (o Reader usa para o destaque dos controles). */
export function useAppPaletteName(): AppPaletteName | null {
  return useContext(AppThemeContext)?.paletteName ?? null;
}

/** Tema resolvido do app ou null fora do provedor (o Reader usa para o tema "Automático" sem exigir o provedor). */
export function useResolvedAppTheme(): "light" | "dark" | null {
  return useContext(AppThemeContext)?.resolvedTheme ?? null;
}
