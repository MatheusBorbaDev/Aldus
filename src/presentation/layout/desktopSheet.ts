import { ViewStyle } from "react-native";

/** Largura dos painéis laterais do leitor no PC. */
export const DESKTOP_SHEET_WIDTH = 400;

/**
 * Leitor do PC (23/11/2026): sumário, busca, ajustes e marcações abrem como painéis laterais de altura inteira em vez de
 * folhas de celular. O painel fica por cima do livro, que não muda de largura: nenhum relayout, nenhuma posição em risco.
 */
export function desktopSheetStyles(side: "left" | "right"): { backdrop: ViewStyle; panel: ViewStyle } {
  return {
    backdrop: {
      flexDirection: "row",
      justifyContent: side === "left" ? "flex-start" : "flex-end",
      alignItems: "stretch",
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: "rgba(0,0,0,0.12)",
    },
    panel: {
      width: DESKTOP_SHEET_WIDTH,
      maxWidth: "100%",
      height: "100%",
      maxHeight: "100%",
      alignSelf: "stretch",
      borderRadius: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderWidth: 0,
      ...(side === "left" ? { borderRightWidth: 1 } : { borderLeftWidth: 1 }),
    },
  };
}
