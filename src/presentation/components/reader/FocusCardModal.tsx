import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReadingSessionRecord } from "@/src/domain/reader/readingSession";
import { focusCardContent, focusCardText } from "@/src/domain/reader/focusCard";
import { secondsPerPage } from "@/src/domain/reader/readingPace";
import { READING_PACE_KEY } from "@/src/presentation/hooks/useChapterTimeLeft";
import { ReaderPalette } from "@/src/theme/tokens";

/**
 * Cartão de foco (FASE 3, C): o resultado medido da sessão de foco, para ver e compartilhar como texto. O título do livro
 * começa desligado; a estimativa de páginas começa ligada só se os números não estiverem ocultos e há ritmo medido.
 */
export function FocusCardModal({ record, title, hideCounts, palette, onShare, onClose }: {
  record: ReadingSessionRecord; title: string; hideCounts: boolean; palette: ReaderPalette;
  onShare: (text: string) => void; onClose: () => void;
}) {
  const [pace, setPace] = useState<number | null>(null);
  const [includeTitle, setIncludeTitle] = useState(false);
  const [includeEstimate, setIncludeEstimate] = useState(!hideCounts);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => AsyncStorage.getItem(READING_PACE_KEY)).then(raw => {
      const samples = raw ? JSON.parse(raw) : [];
      if (active && Array.isArray(samples)) setPace(secondsPerPage(samples.filter((value: unknown): value is number => typeof value === "number")));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const content = focusCardContent(record, { title, includeTitle, includeEstimate, secondsPerPage: pace });
  const toggle = (label: string, value: boolean, change: (value: boolean) => void, disabled = false) => (
    <View style={styles.row}>
      <Text style={{ color: disabled ? palette.secondaryText : palette.text, flex: 1 }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={change} thumbColor={value ? palette.accent : palette.panel} trackColor={{ false: palette.separator, true: palette.accent }} />
    </View>
  );
  const action = (label: string, onPress: () => void, primary = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[styles.action, { borderColor: primary ? palette.accent : palette.separator, backgroundColor: primary ? palette.accent : "transparent" }]}>
      <Text style={{ color: primary ? palette.onAccent : palette.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { backgroundColor: palette.panel, borderColor: palette.separator }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Cartão de foco</Text>
          <View accessibilityLabel="Prévia do cartão" style={[styles.card, { borderColor: palette.accent }]}>
            <Text style={[styles.headline, { color: palette.text }]}>{content.headline}</Text>
            {content.title ? <Text style={{ color: palette.text }}>{content.title}</Text> : null}
            {content.estimate ? <Text style={{ color: palette.secondaryText }}>{content.estimate}</Text> : null}
            <Text style={{ color: palette.secondaryText, fontSize: 12 }}>{content.footer}</Text>
          </View>
          {toggle("Incluir o título do livro", includeTitle, setIncludeTitle)}
          {toggle("Incluir estimativa de páginas", includeEstimate && pace !== null, setIncludeEstimate, pace === null)}
          {pace === null ? <Text style={{ color: palette.secondaryText, fontSize: 13 }}>A estimativa aparece depois que o Aldus medir seu ritmo em algumas viradas de página.</Text> : null}
          {action("Compartilhar cartão", () => onShare(focusCardText(content)), true)}
          {action("Fechar", onClose)}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 8 },
  panel: { width: "100%", maxWidth: 560, alignSelf: "center", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  card: { borderWidth: 2, borderRadius: 16, padding: 16, gap: 6 },
  headline: { fontSize: 22, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  action: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
});
