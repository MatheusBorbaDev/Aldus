import { ReaderFont, ReaderMargin, ReaderTheme } from "@/src/domain/types/reader";
import { PdfReaderTheme } from "@/src/domain/types/pdfReader";

export type AppThemeMode = "system" | "light" | "dark";

export interface AppThemePalette {
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  secondaryText: string;
  separator: string;
  border: string;
  accent: string;
  onAccent: string;
  /** Fundo suave do destaque (chip/seleção ativa); `accent` e `text` mantêm AA sobre ele. */
  accentSoft: string;
  danger: string;
  onDanger: string;
  success: string;
  /** Anel de foco de teclado. */
  focus: string;
  overlay: string;
  card: string;
  input: string;
  tabBar: string;
  panel: string;
}

export const appThemeTokens: Record<"light" | "dark", AppThemePalette> = {
  light: {
    background: "#F7F4EE",
    surface: "#FFFDF9",
    surfaceSecondary: "#EDEFE5",
    text: "#203B32",
    textSecondary: "#5C6A63",
    secondaryText: "#5C6A63",
    separator: "#DADCD1",
    border: "#DADCD1",
    accent: "#A64E32",
    onAccent: "#FFFFFF",
    accentSoft: "#F6E9E1",
    danger: "#B42318",
    onDanger: "#FFFFFF",
    success: "#2E6B4A",
    focus: "#A64E32",
    overlay: "rgba(17, 22, 24, 0.55)",
    card: "#FFFDF9",
    input: "#FFFEFB",
    tabBar: "#FBF9F4",
    panel: "#FFFDF9",
  },
  dark: {
    background: "#111916",
    surface: "#1B2620",
    surfaceSecondary: "#243129",
    text: "#F0F0E7",
    textSecondary: "#B1BDB4",
    secondaryText: "#B1BDB4",
    separator: "#36453B",
    border: "#36453B",
    accent: "#E5A17D",
    onAccent: "#17211B",
    accentSoft: "#3A2A22",
    danger: "#F4A39A",
    onDanger: "#17211B",
    success: "#8FD3A8",
    focus: "#E5A17D",
    overlay: "rgba(8, 12, 14, 0.7)",
    card: "#1E2B23",
    input: "#19251E",
    tabBar: "#17211B",
    panel: "#1B2620",
  },
};

/**
 * Paletas do app (pedido do dono em 16/11/2026: "Clássico" e duas "Moderno"). Cada uma tem claro e escuro, com o mesmo
 * contrato de contraste de `appThemeTokens` (`scripts/test-app-design.cjs`). O Clássico é `appThemeTokens`, sem mudança.
 */
export type AppPaletteName = "classic" | "petroleum" | "ink";

const modernLight = { danger: "#B42318", onDanger: "#FFFFFF", success: "#2E6B4A", overlay: "rgba(17, 22, 24, 0.55)" };
const modernDark = { danger: "#F4A39A", success: "#8FD3A8", overlay: "rgba(8, 12, 14, 0.7)" };

export const appPalettes: Record<AppPaletteName, Record<"light" | "dark", AppThemePalette>> = {
  classic: appThemeTokens,
  petroleum: {
    light: {
      ...modernLight, background: "#F4F7F6", surface: "#FFFFFF", surfaceSecondary: "#E6EEEC", text: "#13221F", textSecondary: "#4B5D58",
      secondaryText: "#4B5D58", separator: "#D3DEDA", border: "#D3DEDA", accent: "#0F6E66", onAccent: "#FFFFFF", accentSoft: "#DDEFEB",
      focus: "#0F6E66", card: "#FFFFFF", input: "#FFFFFF", tabBar: "#F9FBFA", panel: "#FFFFFF",
    },
    dark: {
      ...modernDark, background: "#0E1513", surface: "#16201D", surfaceSecondary: "#1F2B27", text: "#EAF2EF", textSecondary: "#A6B8B2",
      secondaryText: "#A6B8B2", separator: "#2C3B36", border: "#2C3B36", accent: "#5FD0BF", onAccent: "#0E1513", accentSoft: "#173A34",
      onDanger: "#0E1513", focus: "#5FD0BF", card: "#1F2B27", input: "#121B18", tabBar: "#121A17", panel: "#16201D",
    },
  },
  ink: {
    light: {
      ...modernLight, background: "#F5F7FA", surface: "#FFFFFF", surfaceSecondary: "#E9EDF3", text: "#172033", textSecondary: "#4A5568",
      secondaryText: "#4A5568", separator: "#D5DCE5", border: "#D5DCE5", accent: "#2F55C4", onAccent: "#FFFFFF", accentSoft: "#E3EAFB",
      focus: "#2F55C4", card: "#FFFFFF", input: "#FFFFFF", tabBar: "#FAFBFD", panel: "#FFFFFF",
    },
    dark: {
      ...modernDark, background: "#0F141C", surface: "#18202B", surfaceSecondary: "#222C39", text: "#EEF2F7", textSecondary: "#A9B4C2",
      secondaryText: "#A9B4C2", separator: "#2E3A4A", border: "#2E3A4A", accent: "#8EB0FF", onAccent: "#0F141C", accentSoft: "#1E2C4A",
      onDanger: "#0F141C", focus: "#8EB0FF", card: "#222C39", input: "#141B25", tabBar: "#131922", panel: "#18202B",
    },
  },
};

export const appPaletteOptions: ReadonlyArray<{ value: AppPaletteName; label: string; description: string }> = [
  { value: "classic", label: "Clássico", description: "Creme e terracota, o visual original do Aldus." },
  { value: "petroleum", label: "Moderno · Petróleo", description: "Verde-azulado profundo, calmo e atual." },
  { value: "ink", label: "Moderno · Azul-tinta", description: "Fundo frio e azul-tinta, mais nítido." },
];

export function isAppPaletteName(value: unknown): value is AppPaletteName {
  return value === "classic" || value === "petroleum" || value === "ink";
}

export function resolveAppThemeName(mode: AppThemeMode, systemScheme?: "light" | "dark" | null) {
  if (mode === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }
  return mode;
}

/**
 * Temas do livro. BUG 16: `text`, `secondaryText` e `accent` têm contraste AA (4,5:1) sobre `background` e `panel`, e `onAccent` sobre
 * `accent` (texto de segmento/botão selecionado). Contrato em `scripts/test-app-design.cjs`. Claro, Sépia e Papel escureceram `accent`
 * (e Sépia o `secondaryText`); Escuro e Preto já passavam e só ganharam `onAccent` escuro.
 */
export const readerThemes = {
  light: { background: "#F7F4EE", text: "#1F2D2B", secondaryText: "#68716D", separator: "#DDD8CF", accent: "#A64E32", onAccent: "#FFFFFF", panel: "#FFFDF9" },
  dark: { background: "#151918", text: "#E8E6DD", secondaryText: "#9DA7A1", separator: "#343B38", accent: "#E59A76", onAccent: "#151918", panel: "#202725" },
  sepia: { background: "#F3E5C8", text: "#57463A", secondaryText: "#6E5A47", separator: "#D7C5A6", accent: "#8F4528", onAccent: "#FFFFFF", panel: "#F9EED9" },
  paper: { background: "#F5F1E7", text: "#111111", secondaryText: "#37372F", separator: "#D8D0C2", accent: "#9A5530", onAccent: "#FFFFFF", panel: "#F8F4EC" },
  black: { background: "#000000", text: "#E8E8E8", secondaryText: "#A0A0A0", separator: "#303030", accent: "#E59A76", onAccent: "#000000", panel: "#151515" },
} as const;

export const pdfReaderThemes: Record<PdfReaderTheme, ReaderPalette> = {
  ...readerThemes,
};

/**
 * Controles do Reader (botões, painéis, seleção) seguem a paleta do app; o tema do livro (fundo e texto) não muda.
 * Usa o destaque claro ou escuro da paleta conforme o fundo do livro; se não tiver AA (4,5:1) sobre o fundo e o
 * painel do livro, mantém o destaque do próprio tema. O documento do livro não recebe `accent`.
 */
export function readerChromePalette(reader: ReaderPalette, paletteName: AppPaletteName | null | undefined): ReaderPalette {
  if (!paletteName || paletteName === "classic") return reader;
  const variants = appPalettes[paletteName];
  const candidate = relativeLuminance(reader.background) < 0.2 ? variants.dark : variants.light;
  const fits = contrastRatio(candidate.accent, reader.background) >= 4.5 && contrastRatio(candidate.accent, reader.panel) >= 4.5
    && contrastRatio(candidate.onAccent, candidate.accent) >= 4.5;
  return fits ? { ...reader, accent: candidate.accent, onAccent: candidate.onAccent } : reader;
}

function relativeLuminance(hex: string) {
  const channels = (hex.replace("#", "").match(/../g) ?? ["00", "00", "00"]).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string) {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

export const fontFamilies: Record<ReaderFont, string> = { serif: "Georgia", sans: "System", dyslexic: "Verdana" };
export const marginSizes: Record<ReaderMargin, number> = { small: 18, medium: 30, large: 46 };
export interface ReaderPalette {
  background: string;
  text: string;
  secondaryText: string;
  separator: string;
  accent: string;
  /** Texto sobre um preenchimento `accent`. */
  onAccent: string;
  panel: string;
}
