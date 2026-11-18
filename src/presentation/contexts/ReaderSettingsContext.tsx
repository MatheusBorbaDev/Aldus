import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { latestWriteTracker } from "@/src/core/utils/latestWrite";
import { resolveReaderTheme } from "@/src/domain/reader/readerThemeAuto";
import { useAppPaletteName, useResolvedAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { isPaperTexture, PaperTexture } from "@/src/domain/reader/paperTexture";
import { isPageTurn, PageTurn } from "@/src/domain/reader/pageTurn";
import { isPdfFlow } from "@/src/domain/reader/pdfScroll";
import { ReaderFont, ReaderMargin, ReaderTheme } from "@/src/domain/types/reader";
import { fontFamilies, marginSizes, readerChromePalette, readerThemes, ReaderPalette } from "@/src/theme/tokens";

interface ReaderSettingsValue {
  /** Tema efetivo do livro (já considera "Automático"). */
  theme: ReaderTheme;
  /** Tema escolhido pelo leitor (o que é salvo). */
  selectedTheme: ReaderTheme;
  /** "Automático": o livro acompanha o claro/escuro do app. */
  followAppTheme: boolean;
  setFollowAppTheme: (value: boolean) => void;
  /** Aplica a regra de "Automático" a um tema escolhido (usado pelos ajustes do PDF). */
  resolveTheme: <T extends ReaderTheme>(selected: T) => T | ReaderTheme;
  font: ReaderFont;
  fontSize: number;
  margin: ReaderMargin;
  lineHeight: number;
  paragraphSpacing: number;
  maxWidth: number;
  brightness: number;
  useSystemBrightness: boolean;
  hideReadingCounts: boolean;
  /** Alinhamento do texto do EPUB (o PDF Reflow tem o seu, nos ajustes do PDF). */
  alignment: "left" | "justify";
  setAlignment: (value: "left" | "justify") => void;
  /** Textura de papel da página (EPUB e Leitura Livre). Padrão: sem textura. */
  paperTexture: PaperTexture;
  setPaperTexture: (value: PaperTexture) => void;
  /** Virada de página (EPUB e Leitura Livre). Padrão: deslizar, como sempre foi. */
  pageTurn: PageTurn;
  setPageTurn: (value: PageTurn) => void;
  /** EPUB e Leitura Livre: páginas ou rolagem contínua (Fase E). Padrão: páginas. */
  readingFlow: "paged" | "scroll";
  setReadingFlow: (value: "paged" | "scroll") => void;
  palette: ReaderPalette;
  fontFamily: string;
  marginSize: number;
  setTheme: (value: ReaderTheme) => void;
  setFont: (value: ReaderFont) => void;
  setFontSize: (value: number) => void;
  setMargin: (value: ReaderMargin) => void;
  setLineHeight: (value: number) => void;
  setParagraphSpacing: (value: number) => void;
  setMaxWidth: (value: number) => void;
  setBrightness: (value: number) => void;
  setUseSystemBrightness: (value: boolean) => void;
  setHideReadingCounts: (value: boolean) => void;
  /** Mensagem quando a última gravação dos ajustes falhou (os ajustes valem só até fechar o app); null quando salvou. */
  saveError: string | null;
}

const READER_SETTINGS_STORAGE_KEY = "@kindle/reader-settings.v1";
/** Padrões do EPUB; o painel usa estes valores como opção "Médio" (BUG 15). Alterar muda a leitura de quem nunca ajustou. */
export const DEFAULT_READER_LINE_HEIGHT = 1.65;
export const DEFAULT_READER_PARAGRAPH_SPACING = 1;
export const READER_SETTINGS_SAVE_ERROR = "Não foi possível salvar os ajustes de leitura neste aparelho. Eles valem até você fechar o app.";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const ReaderSettingsContext = createContext<ReaderSettingsValue | null>(null);

export function ReaderSettingsProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<ReaderTheme>("sepia");
  const [font, setFont] = useState<ReaderFont>("serif");
  const [fontSize, setFontSize] = useState(16);
  const [margin, setMargin] = useState<ReaderMargin>("medium");
  const [lineHeight, setLineHeight] = useState(DEFAULT_READER_LINE_HEIGHT);
  const [paragraphSpacing, setParagraphSpacing] = useState(DEFAULT_READER_PARAGRAPH_SPACING);
  const [maxWidth, setMaxWidth] = useState(900);
  const [brightness, setBrightness] = useState(65);
  const [useSystemBrightness, setUseSystemBrightness] = useState(true);
  const [ready, setReady] = useState(false);
  const [hideReadingCounts, setHideReadingCounts] = useState(false);
  const [followAppTheme, setFollowAppTheme] = useState(false);
  const [alignment, setAlignment] = useState<"left" | "justify">("left");
  const [paperTexture, setPaperTexture] = useState<PaperTexture>("none");
  const [pageTurn, setPageTurn] = useState<PageTurn>("slide");
  const [readingFlow, setReadingFlow] = useState<"paged" | "scroll">("paged");
  const appTheme = useResolvedAppTheme();
  const appPalette = useAppPaletteName();
  const [saveError, setSaveError] = useState<string | null>(null);
  const trackSave = useMemo(() => latestWriteTracker(failed => setSaveError(failed ? READER_SETTINGS_SAVE_ERROR : null)), []);
  // Leitura falhou: os padrões em memória não podem sobrescrever os ajustes salvos; só uma mudança do leitor grava (onda 5).
  const skipUnchangedSave = useRef(false);

  useEffect(() => {
    let disposed = false;

    void AsyncStorage.getItem(READER_SETTINGS_STORAGE_KEY).then((stored) => {
      if (disposed || !stored) {
        if (!disposed) setReady(true);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as Partial<{
          theme: ReaderTheme;
          font: ReaderFont;
          fontSize: number;
          margin: ReaderMargin;
          lineHeight: number;
          paragraphSpacing: number;
          maxWidth: number;
          brightness: number;
          useSystemBrightness: boolean;
          hideReadingCounts: boolean;
          followAppTheme: boolean;
          alignment: "left" | "justify";
          paperTexture: PaperTexture;
          pageTurn: PageTurn;
          readingFlow: "paged" | "scroll";
        }>;

        if (parsed.theme && parsed.theme in readerThemes) setTheme(parsed.theme);
        if (parsed.font && parsed.font in fontFamilies) setFont(parsed.font);
        if (typeof parsed.fontSize === "number") setFontSize(clamp(parsed.fontSize, 12, 30));
        if (parsed.margin && parsed.margin in marginSizes) setMargin(parsed.margin);
        if (typeof parsed.lineHeight === "number") setLineHeight(clamp(parsed.lineHeight, 1.1, 2.2));
        if (typeof parsed.paragraphSpacing === "number") setParagraphSpacing(clamp(parsed.paragraphSpacing, 0.3, 2));
        if (typeof parsed.maxWidth === "number") setMaxWidth(clamp(parsed.maxWidth, 500, 1400));
        if (typeof parsed.brightness === "number") setBrightness(clamp(parsed.brightness, 20, 100));
        if (typeof parsed.useSystemBrightness === "boolean") setUseSystemBrightness(parsed.useSystemBrightness);
        if (typeof parsed.hideReadingCounts === "boolean") setHideReadingCounts(parsed.hideReadingCounts);
        if (typeof parsed.followAppTheme === "boolean") setFollowAppTheme(parsed.followAppTheme);
        if (parsed.alignment === "left" || parsed.alignment === "justify") setAlignment(parsed.alignment);
        if (isPaperTexture(parsed.paperTexture)) setPaperTexture(parsed.paperTexture);
        if (isPageTurn(parsed.pageTurn)) setPageTurn(parsed.pageTurn);
        if (isPdfFlow(parsed.readingFlow)) setReadingFlow(parsed.readingFlow);
      } catch {
        // Ignore invalid persisted settings and keep defaults.
      } finally {
        if (!disposed) setReady(true);
      }
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
    trackSave(AsyncStorage.setItem(READER_SETTINGS_STORAGE_KEY, JSON.stringify({
      theme,
      font,
      fontSize,
      margin,
      lineHeight,
      paragraphSpacing,
      maxWidth,
      brightness,
      useSystemBrightness,
      hideReadingCounts,
      followAppTheme,
      alignment,
      paperTexture,
      pageTurn,
      readingFlow,
    })));
  }, [alignment, brightness, paperTexture, pageTurn, readingFlow, followAppTheme, font, fontSize, hideReadingCounts, lineHeight, margin, maxWidth, paragraphSpacing, ready, theme, trackSave, useSystemBrightness]);

  const value = useMemo<ReaderSettingsValue>(() => {
    const resolveTheme = <T extends ReaderTheme>(selected: T) => resolveReaderTheme(selected, followAppTheme, appTheme);
    const effective = resolveTheme(theme);
    return {
    theme: effective,
    selectedTheme: theme,
    followAppTheme,
    setFollowAppTheme,
    resolveTheme,
    font,
    fontSize,
    margin,
    lineHeight,
    paragraphSpacing,
    maxWidth,
    brightness,
    useSystemBrightness,
    hideReadingCounts,
    alignment,
    setAlignment,
    paperTexture,
    setPaperTexture: (value) => { if (isPaperTexture(value)) setPaperTexture(value); },
    pageTurn,
    setPageTurn: (value) => { if (isPageTurn(value)) setPageTurn(value); },
    readingFlow,
    setReadingFlow: (value) => { if (isPdfFlow(value)) setReadingFlow(value); },
    palette: readerChromePalette(readerThemes[effective], appPalette),
    fontFamily: fontFamilies[font],
    marginSize: marginSizes[margin],
    // Escolher um tema é uma decisão explícita: desliga o "Automático" para o tema escolhido valer.
    setTheme: (value) => { setFollowAppTheme(false); setTheme(value); },
    setFont,
    setFontSize: (value) => setFontSize(clamp(value, 12, 30)),
    setMargin,
    setLineHeight: (value) => setLineHeight(clamp(value, 1.1, 2.2)),
    setParagraphSpacing: (value) => setParagraphSpacing(clamp(value, 0.3, 2)),
    setMaxWidth: (value) => setMaxWidth(clamp(value, 500, 1400)),
    setBrightness: (value) => setBrightness(clamp(value, 20, 100)),
    setUseSystemBrightness,
    setHideReadingCounts,
    saveError,
  };
  }, [alignment, appPalette, appTheme, brightness, pageTurn, paperTexture, readingFlow, followAppTheme, font, fontSize, hideReadingCounts, lineHeight, margin, maxWidth, paragraphSpacing, saveError, theme, useSystemBrightness]);

  return <ReaderSettingsContext.Provider value={value}>{children}</ReaderSettingsContext.Provider>;
}

/** "Ocultar porcentagem e páginas" fora do leitor (Biblioteca). Sem o provedor (telas isoladas, testes): não oculta. */
export function useHideReadingCounts(): boolean {
  return useContext(ReaderSettingsContext)?.hideReadingCounts ?? false;
}

export function useReaderSettings() {
  const value = useContext(ReaderSettingsContext);
  if (!value) throw new Error("useReaderSettings must be used within ReaderSettingsProvider");
  return value;
}
