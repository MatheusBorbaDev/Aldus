import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { ReaderPalette } from "@/src/theme/tokens";

/**
 * Aviso flutuante do Reader (extraído do ReaderScreen, onda B1). `transient`: confirmação curta, estreita e sem botão (some sozinha
 * no ReaderScreen); senão é um alerta que fica até o leitor fechar. Não intercepta toques fora da própria faixa.
 */
export function ReaderFeedbackBanner({ message, transient, palette, top, onDismiss, onLayout }: {
  message: string; transient: boolean; palette: ReaderPalette; top: number; onDismiss: () => void; onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View
      accessibilityRole={transient ? undefined : "alert"}
      onLayout={onLayout}
      pointerEvents="box-none"
      style={[styles.reflowFeedback, transient ? styles.reflowFeedbackTransient : null, { backgroundColor: palette.panel, borderColor: palette.separator, top }]}
    >
      <Text accessibilityLiveRegion="polite" style={[styles.reflowFeedbackText, { color: palette.text }]}>{message}</Text>
      {transient ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={onDismiss} style={styles.reflowFeedbackClose}>
          <Text style={{ color: palette.accent, fontWeight: "600" }}>Fechar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  reflowFeedback: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Confirmação curta: faixa estreita e centralizada, sem botão; não cobre a largura do texto.
  reflowFeedbackTransient: {
    alignSelf: "center",
    left: undefined,
    right: undefined,
    maxWidth: 320,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  reflowFeedbackText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  reflowFeedbackClose: {
    flexShrink: 0,
    alignSelf: "center",
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
