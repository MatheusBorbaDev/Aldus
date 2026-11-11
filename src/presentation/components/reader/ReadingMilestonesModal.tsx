import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createMilestonePlan, MILESTONE_COUNTS, MILESTONE_DEADLINES, MILESTONE_DRM_NOTICE, MilestonePlan, milestoneDates, milestoneStatus, milestoneThresholds,
} from "@/src/domain/reader/readingMilestones";
import { ReaderPalette } from "@/src/theme/tokens";

/**
 * Marcos de leitura (FASE 5b): dividir o livro em marcos iguais, prazo opcional, "marco 2 de 3" e cronograma em texto.
 * Só local; sem comentários, feed, chat ou ranking. `hideCounts` segue "Ocultar porcentagem e páginas".
 */
export function ReadingMilestonesModal({ visible, title, plan, progress, hideCounts, palette, onSave, onShare, onClose }: {
  visible: boolean; title: string; plan: MilestonePlan | null; progress: number; hideCounts: boolean; palette: ReaderPalette;
  onSave: (plan: MilestonePlan | null) => void; onShare: (plan: MilestonePlan) => void; onClose: () => void;
}) {
  const [count, setCount] = useState<number>(plan?.count ?? 3);
  // "keep": mantém início e prazo do plano salvo; escolher um prazo recomeça o cronograma a partir de hoje.
  const [deadline, setDeadline] = useState<string>(plan ? "keep" : "none");
  useEffect(() => { if (visible) { setCount(plan?.count ?? 3); setDeadline(plan ? "keep" : "none"); } }, [visible, plan]);
  const draft: MilestonePlan = plan && deadline === "keep" ? { ...plan, count }
    : createMilestonePlan(count, MILESTONE_DEADLINES.find(item => item.id === deadline)?.days ?? null, new Date());
  const dates = milestoneDates(draft);
  const status = milestoneStatus(draft, progress);
  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={[styles.chip, { borderColor: selected ? palette.accent : palette.separator, borderWidth: selected ? 2 : 1 }]}>
      <Text style={{ color: palette.text, fontWeight: selected ? "700" : "400" }}>{label}</Text>
    </Pressable>
  );
  const action = (label: string, onPress: () => void, primary = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[styles.action, { borderColor: primary ? palette.accent : palette.separator, backgroundColor: primary ? palette.accent : "transparent" }]}>
      <Text style={{ color: primary ? palette.panel : palette.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { backgroundColor: palette.panel, borderColor: palette.separator }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Marcos de leitura</Text>
            <Text numberOfLines={2} style={{ color: palette.secondaryText }}>{title}</Text>
            {plan && !hideCounts ? <Text style={{ color: palette.text }}>{status.next === null ? "Todos os marcos alcançados." : `Agora: marco ${status.next} de ${status.count}.`}</Text> : null}
            <Text style={[styles.label, { color: palette.text }]}>Dividir o livro em</Text>
            <View style={styles.row}>{MILESTONE_COUNTS.map(value => chip(`c${value}`, `${value} marcos`, count === value, () => setCount(value)))}</View>
            <Text style={[styles.label, { color: palette.text }]}>Prazo</Text>
            <View style={styles.row}>{MILESTONE_DEADLINES.map(item => chip(item.id, item.label, deadline === item.id, () => setDeadline(item.id)))}</View>
            <View style={[styles.card, { borderColor: palette.separator }]}>
              {milestoneThresholds(draft.count).map((fraction, i) => (
                <Text key={i} style={{ color: palette.text }}>
                  {`Marco ${i + 1}: até ${Math.round(fraction * 100)}% do livro${dates[i] ? ` · até ${dates[i]!.slice(8, 10)}/${dates[i]!.slice(5, 7)}` : ""}`}
                </Text>
              ))}
            </View>
            <Text style={[styles.hint, { color: palette.secondaryText }]}>{MILESTONE_DRM_NOTICE} O cronograma compartilhado é só texto, sem o seu progresso.</Text>
            {action("Salvar marcos", () => onSave(draft), true)}
            {plan ? action("Compartilhar cronograma", () => onShare(plan)) : null}
            {plan ? action("Remover marcos", () => onSave(null)) : null}
            {action("Fechar", onClose)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 8 },
  panel: { width: "100%", maxWidth: 560, maxHeight: "90%", alignSelf: "center", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  label: { fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  hint: { fontSize: 13, lineHeight: 19 },
  action: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
});
