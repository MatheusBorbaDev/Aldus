/**
 * Módulo PC × celular (23/11/2026, pedido do dono: "deve ser algo realmente pra pc, sem o formato de celular").
 * Uma única decisão para o app inteiro: PC é a Web numa janela larga com mouse ou trackpad como ponteiro principal.
 * Tablet e celular (inclusive a Web no celular) continuam com o layout de toque. Dados, contas e sincronismo são os mesmos.
 */
export type FormFactor = "desktop" | "tablet" | "phone";

/** Abaixo disso a janela do PC fica com o layout de toque (lado a lado não cabe com folga). */
export const DESKTOP_MIN_WIDTH = 1024;
/** Mesmo limite da barra lateral de toque (`layout.sidebarBreakpoint`). */
export const TABLET_MIN_WIDTH = 768;

export interface FormFactorInput {
  web: boolean;
  width: number;
  /** `(pointer: fine)`: o ponteiro principal é mouse ou trackpad. */
  finePointer: boolean;
}

export function formFactorFor({ web, width, finePointer }: FormFactorInput): FormFactor {
  if (web && finePointer && width >= DESKTOP_MIN_WIDTH) return "desktop";
  return width >= TABLET_MIN_WIDTH ? "tablet" : "phone";
}
