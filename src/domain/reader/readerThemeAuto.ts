import { ReaderTheme } from "@/src/domain/types/reader";

const DARK_THEMES: ReadonlySet<ReaderTheme> = new Set(["dark", "black"]);

/**
 * Tema efetivo do livro quando "Automático" (seguir o app) está ligado.
 * - Desligado ou tema do app desconhecido: o tema escolhido, sem mudança.
 * - App escuro: mantém Escuro/Preto se já escolhidos; senão Escuro.
 * - App claro: mantém Claro/Papel/Sépia se já escolhidos; senão Papel.
 * O tema escolhido continua salvo; só a exibição muda (nada é regravado).
 */
export function resolveReaderTheme<T extends ReaderTheme>(selected: T, followApp: boolean, appTheme: "light" | "dark" | null): T | ReaderTheme {
  if (!followApp || !appTheme) return selected;
  const dark = DARK_THEMES.has(selected);
  if (appTheme === "dark") return dark ? selected : "dark";
  return dark ? "paper" : selected;
}
