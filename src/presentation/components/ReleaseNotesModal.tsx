import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RELEASE_NOTES, RELEASE_NOTES_SEEN_KEY, shouldShowReleaseNotes } from "@/src/domain/brand/releaseNotes";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";

/**
 * Novidades da versão com o aviso de beta (18/11/2026). Aparece uma vez por versão; "Entendi" ou o link para "O que esperar desta
 * beta" marcam como visto neste aparelho. Falha ao gravar não prende a pessoa no aviso.
 */
export function ReleaseNotesModal() {
  const { palette } = useAppTheme();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(RELEASE_NOTES_SEEN_KEY)
      .then(seen => { if (alive && shouldShowReleaseNotes(seen, false)) setVisible(true); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const close = (next?: () => void) => {
    setVisible(false);
    void AsyncStorage.setItem(RELEASE_NOTES_SEEN_KEY, RELEASE_NOTES.id).catch(() => undefined);
    next?.();
  };
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close()}>
      <View style={[styles.backdrop, { backgroundColor: "rgba(10,12,20,0.55)" }]}>
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: palette.panel ?? palette.surface, borderColor: palette.border }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.head}>
              <Image source={require("../../../assets/brand/medalha-noite.png")} style={styles.medal} accessible={false} />
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Novidades do Aldus</Text>
                <Text style={[styles.date, { color: palette.secondaryText }]}>{RELEASE_NOTES.date}</Text>
              </View>
            </View>
            <View style={[styles.beta, { backgroundColor: palette.accentSoft ?? palette.surfaceSecondary, borderColor: palette.border }]}>
              <View style={styles.betaHead}>
                <Ionicons name="flask-outline" size={18} color={palette.accent} />
                <Text style={[styles.betaTitle, { color: palette.text }]}>Esta é uma versão beta</Text>
              </View>
              <Text style={[styles.betaText, { color: palette.text }]}>O app funciona, mas ainda está sendo construído: algumas partes têm limites e podem mudar. Seu relato ajuda a decidir o que vem primeiro.</Text>
              <Pressable accessibilityRole="link" accessibilityLabel="O que esperar desta beta" onPress={() => close(() => router.push("/beta" as never))} style={styles.link}>
                <Text style={[styles.linkText, { color: palette.accent }]}>O que esperar desta beta</Text>
                <Ionicons name="arrow-forward" size={16} color={palette.accent} />
              </Pressable>
            </View>
            <Text style={[styles.section, { color: palette.secondaryText }]}>O QUE MUDOU</Text>
            <View style={styles.items}>
              {RELEASE_NOTES.items.map(item => (
                <View key={item} style={styles.item}>
                  <View style={[styles.dot, { backgroundColor: palette.accent }]} />
                  <Text style={[styles.itemText, { color: palette.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Entendi" onPress={() => close()} style={[styles.primary, { backgroundColor: palette.accent }]}>
            <Text style={[styles.primaryText, { color: palette.onAccent ?? "#fff" }]}>Entendi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  card: { width: "100%", maxWidth: 440, maxHeight: "88%", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  content: { padding: 22, paddingBottom: 12, gap: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  medal: { width: 52, height: 52 },
  title: { fontFamily: "serif", fontSize: 22, fontWeight: "700" },
  date: { fontSize: 13, marginTop: 2 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, marginBottom: -6 },
  items: { gap: 11 },
  item: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 8 },
  itemText: { flex: 1, fontSize: 15, lineHeight: 22 },
  beta: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  betaHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  betaTitle: { fontSize: 15, fontWeight: "700" },
  betaText: { fontSize: 14, lineHeight: 21 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  linkText: { fontSize: 15, fontWeight: "700" },
  primary: { minHeight: 50, margin: 16, marginTop: 6, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontWeight: "700" },
});
