import { Pressable, StyleSheet, Text, View } from "react-native";
import { HighlightColor } from "@/src/domain/repositories/HighlightRepository";
import { ReaderStudyAdjust } from "@/src/presentation/components/EpubPageViewerProps";
import { studyColorNames, studyColorSwatches } from "@/src/presentation/components/StudyPanelControls";
import { ReaderPalette } from "@/src/theme/tokens";

const ADJUSTMENTS: ReadonlyArray<{ op: ReaderStudyAdjust; label: string }> = [
  { op: "growStart", label: "Palavra antes" },
  { op: "growEnd", label: "Palavra depois" },
  { op: "shrinkEnd", label: "Tirar a última" },
  { op: "sentence", label: "Frase inteira" },
];

/**
 * Pop-up do grifo (Fase B, 16/11/2026): aparece quando a seleção termina, baixo para o texto continuar visível. Uma cor grava o
 * grifo na hora; o trecho pode ser ajustado palavra a palavra ou pela frase sem depender das alças do sistema; "Adicionar nota"
 * abre o painel completo com o trecho. Enquanto ele está aberto, os toques de virar página e mostrar controles ficam suspensos.
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
  const colors = Object.keys(studyColorNames) as HighlightColor[];
  return (
    <View accessibilityLabel="Grifar trecho" style={[styles.sheet, { bottom, backgroundColor: palette.panel, borderColor: palette.separator }]}>
      {quote ? <Text numberOfLines={3} style={[styles.quote, { color: palette.text }]}>“{quote}”</Text> : null}
      {error ? <Text accessibilityRole="alert" style={[styles.message, { color: palette.text }]}>{error}</Text> : null}
      {!quote && !error ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: palette.secondaryText }]}>Selecionando…</Text> : null}
      {quote ? <>
        <View style={styles.row}>
          {colors.map(color => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Grifar em ${studyColorNames[color].toLowerCase()}`} disabled={busy}
            onPress={() => onColor(color)} android_ripple={{ color: palette.separator, borderless: true }} style={[styles.swatchTarget, { opacity: busy ? 0.5 : 1 }]}>
            <View style={[styles.swatch, { backgroundColor: studyColorSwatches[color], borderColor: palette.separator }]} />
          </Pressable>)}
        </View>
        <View style={styles.row}>
          {ADJUSTMENTS.map(item => <Chip key={item.op} label={item.label} disabled={busy} palette={palette} onPress={() => onAdjust(item.op)} />)}
        </View>
      </> : null}
      <View style={styles.row}>
        {quote ? <Chip label="Adicionar nota" disabled={busy} palette={palette} onPress={onNote} strong /> : null}
        {quote && onShare ? <Chip label="Compartilhar" disabled={busy} palette={palette} onPress={onShare} strong /> : null}
        <Chip label={quote ? "Cancelar" : "Fechar"} disabled={false} palette={palette} onPress={onCancel} />
      </View>
    </View>
  );
}

function Chip({ label, onPress, disabled, palette, strong = false }: { label: string; onPress: () => void; disabled: boolean; palette: ReaderPalette; strong?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      android_ripple={{ color: palette.separator }} style={[styles.chip, { borderColor: strong ? palette.accent : palette.separator, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={{ color: strong ? palette.accent : palette.text, fontWeight: strong ? "700" : "500", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 12, right: 12, zIndex: 35, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  quote: { fontFamily: "Georgia", fontSize: 16, lineHeight: 23 },
  message: { fontSize: 15, lineHeight: 21 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  swatchTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 22, justifyContent: "center" },
});
