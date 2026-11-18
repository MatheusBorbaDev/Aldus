import { useState, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HighlightColor } from "@/src/domain/repositories/HighlightRepository";
import { ReaderStudyAdjust } from "@/src/presentation/components/EpubPageViewerProps";
import { studyColorNames, studyColorSwatches } from "@/src/presentation/components/StudyPanelControls";
import { ReaderPalette } from "@/src/theme/tokens";

/** Início e fim do trecho com − e +, como no Kindle, e a frase inteira. Os rótulos falados dizem a consequência. */
const ENDS: ReadonlyArray<{ title: string; minus: { op: ReaderStudyAdjust; label: string }; plus: { op: ReaderStudyAdjust; label: string } }> = [
  { title: "Início", minus: { op: "shrinkStart", label: "Tirar a primeira" }, plus: { op: "growStart", label: "Palavra antes" } },
  { title: "Fim", minus: { op: "shrinkEnd", label: "Tirar a última" }, plus: { op: "growEnd", label: "Palavra depois" } },
];

/**
 * Pop-up do grifo (Fase B, 16/11/2026; redesenho compacto aprovado em 18/11/2026). Trecho numa linha com fechar, as cores numa
 * linha e três ações (Nota, Card, Ajustar); o ajuste só aparece quando pedido, para o texto do livro continuar visível. Uma cor
 * grava o grifo na hora. Enquanto ele está aberto, os toques de virar página e mostrar controles ficam suspensos.
 */
export function HighlightSelectionPopup({ quote, error, busy, palette, bottom, onColor, onAdjust, onNote, onShare, onCancel }: {
  quote: string | null;
  error: string | null;
  busy: boolean;
  palette: ReaderPalette;
  bottom: number;
  onColor: (color: HighlightColor) => void;
  onAdjust: (op: ReaderStudyAdjust) => void;
  onNote: () => void;
  /** Card do trecho para Stories/X (Fase C). Ausente = sem o botão. */
  onShare?: () => void;
  onCancel: () => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const colors = Object.keys(studyColorNames) as HighlightColor[];
  const action = (label: string, icon: ComponentProps<typeof Ionicons>["name"], text: string, onPress: () => void, options: { strong?: boolean; selected?: boolean } = {}) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy, expanded: options.selected }} disabled={busy} onPress={onPress}
      android_ripple={{ color: palette.separator }}
      style={[styles.action, { borderColor: options.strong || options.selected ? palette.accent : palette.separator, backgroundColor: options.selected ? palette.background : "transparent", opacity: busy ? 0.5 : 1 }]}>
      <Ionicons name={icon} size={17} color={options.strong ? palette.accent : palette.text} />
      <Text numberOfLines={1} style={{ color: options.strong ? palette.accent : palette.text, fontWeight: options.strong ? "700" : "500", fontSize: 14 }}>{text}</Text>
    </Pressable>
  );
  const step = (item: { op: ReaderStudyAdjust; label: string }, symbol: string) => (
    <Pressable key={item.op} accessibilityRole="button" accessibilityLabel={item.label} disabled={busy} onPress={() => onAdjust(item.op)}
      android_ripple={{ color: palette.separator, borderless: true }} style={[styles.step, { backgroundColor: palette.background, opacity: busy ? 0.5 : 1 }]}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>{symbol}</Text>
    </Pressable>
  );
  return (
    <View accessibilityLabel="Grifar trecho" style={[styles.sheet, { bottom, backgroundColor: palette.panel, borderColor: palette.separator }]}>
      <View style={styles.head}>
        {quote ? <Text numberOfLines={1} style={[styles.quote, { color: palette.secondaryText }]}>“{quote}”</Text>
          : error ? <View style={styles.spacer} /> : <Text accessibilityLiveRegion="polite" style={[styles.message, { color: palette.secondaryText }]}>Selecionando…</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={quote ? "Cancelar" : "Fechar"} disabled={false} onPress={onCancel} style={styles.close}>
          <Ionicons name="close" size={20} color={palette.secondaryText} />
        </Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.message, { color: palette.text }]}>{error}</Text> : null}
      {quote ? <>
        <View style={styles.colors}>
          {colors.map(color => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Grifar em ${studyColorNames[color].toLowerCase()}`} disabled={busy}
            onPress={() => onColor(color)} android_ripple={{ color: palette.separator, borderless: true }} style={[styles.swatchTarget, { opacity: busy ? 0.5 : 1 }]}>
            <View style={[styles.swatch, { backgroundColor: studyColorSwatches[color], borderColor: palette.separator }]} />
          </Pressable>)}
        </View>
        <View style={styles.actions}>
          {action("Adicionar nota", "create-outline", "Nota", onNote)}
          {onShare ? action("Compartilhar", "share-outline", "Card", onShare, { strong: true }) : null}
          {action(adjusting ? "Fechar ajuste do trecho" : "Ajustar trecho", "options-outline", "Ajustar", () => setAdjusting(!adjusting), { selected: adjusting })}
        </View>
        {adjusting ? <View accessibilityLabel="Ajustar o trecho" style={[styles.adjust, { borderTopColor: palette.separator }]}>
          {ENDS.map(end => <View key={end.title} style={[styles.end, { borderColor: palette.separator }]}>
            <Text style={[styles.endTitle, { color: palette.secondaryText }]}>{end.title}</Text>
            <View style={styles.steps}>{step(end.minus, "−")}{step(end.plus, "+")}</View>
          </View>)}
          <View style={[styles.end, { borderColor: palette.separator }]}>
            <Text style={[styles.endTitle, { color: palette.secondaryText }]}>Frase</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Frase inteira" disabled={busy} onPress={() => onAdjust("sentence")}
              android_ripple={{ color: palette.separator }} style={[styles.sentence, { backgroundColor: palette.background, opacity: busy ? 0.5 : 1 }]}>
              <Text style={{ color: palette.text, fontWeight: "600", fontSize: 13 }}>inteira</Text>
            </Pressable>
          </View>
        </View> : null}
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 10, right: 10, zIndex: 35, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, gap: 8, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 4 },
  quote: { flex: 1, fontFamily: "Georgia", fontStyle: "italic", fontSize: 14 },
  message: { flex: 1, fontSize: 15, lineHeight: 21 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
  colors: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  swatchTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6 },
  spacer: { flex: 1 },
  adjust: { flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  end: { flexGrow: 1, minWidth: 100, borderWidth: 1, borderRadius: 12, alignItems: "center", paddingVertical: 6, gap: 4 },
  endTitle: { fontSize: 12 },
  steps: { flexDirection: "row", gap: 6 },
  step: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sentence: { minHeight: 44, minWidth: 64, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
});
