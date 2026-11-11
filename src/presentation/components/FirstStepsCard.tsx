import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AppText, Button, IconName, radius, space } from "@/src/ui";

/** Chave neste aparelho (prefixo legado `@kindle/` preservado). */
export const FIRST_STEPS_KEY = "@kindle/first-steps-seen.v1";

export const FIRST_STEPS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "add-circle-outline", title: "Traga seus livros", body: "Toque em + para importar EPUB ou PDF do aparelho, conectar uma pasta do Google Drive ou buscar em catálogos públicos." },
  { icon: "book-outline", title: "Leia do seu jeito", body: "Toque no centro da página para mostrar ou esconder os controles. Em Aa você ajusta letra, tema e brilho; segure um trecho para grifar." },
  { icon: "school-outline", title: "Revise o que leu", body: "Transforme grifos em flashcards e revise em Estudo. Lá você vê o que está para revisar hoje." },
];

/**
 * Primeiro uso guiado (onda A5): cartão no topo da Biblioteca, não bloqueia a tela. Aparece até o leitor tocar em "Entendi" ou
 * "Pular". Se a leitura da preferência falhar, não aparece (melhor não insistir do que repetir a cada abertura).
 */
export function FirstStepsCard() {
  const { palette } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => AsyncStorage.getItem(FIRST_STEPS_KEY)).then(value => { if (active && value === null) setVisible(true); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!visible) return null;
  const dismiss = () => { setVisible(false); void Promise.resolve().then(() => AsyncStorage.setItem(FIRST_STEPS_KEY, String(Date.now()))).catch(() => undefined); };
  const current = FIRST_STEPS[step], last = step === FIRST_STEPS.length - 1;
  return (
    <View accessibilityLabel="Primeiros passos" style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.head}>
        <AppText variant="overline" tone="accent">Primeiros passos · {step + 1} de {FIRST_STEPS.length}</AppText>
        <View style={styles.dots}>
          {FIRST_STEPS.map((_, index) => <View key={index} style={[styles.dot, { backgroundColor: index === step ? palette.accent : palette.separator }]} />)}
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: palette.accentSoft }]}><Ionicons name={current.icon} size={22} color={palette.accent} /></View>
        <View style={styles.text}>
          <AppText variant="heading">{current.title}</AppText>
          <AppText variant="bodySmall" tone="secondary">{current.body}</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        {last ? null : <Button label="Pular" variant="ghost" accessibilityLabel="Pular primeiros passos" onPress={dismiss} />}
        {step > 0 ? <Button label="Voltar" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        <Button label={last ? "Entendi" : "Próximo"} variant="primary" onPress={() => last ? dismiss() : setStep(step + 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  body: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: space.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: space.sm },
});
