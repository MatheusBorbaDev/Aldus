import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { appThemeTokens } from "@/src/theme/tokens";
import { radius, space, touchTarget, typography } from "./tokens";

export interface ErrorScreenProps {
  /** Renderiza a árvore de novo (ex.: `retry` do expo-router). */
  onRetry(): void;
  /** Sai da tela que falhou para um lugar seguro (Biblioteca). */
  onHome?(): void;
  /** Detalhe técnico mostrado só em desenvolvimento; nunca em produção. */
  detail?: string;
}

/**
 * Tela de recuperação de erro de renderização (BUG 14). Usada pela fronteira de erro da raiz,
 * onde os providers (tema, Auth) podem não existir: por isso não usa `useAppTheme()` nem os
 * primitivos que dependem dele. Cores vêm dos tokens do app conforme o esquema do sistema.
 * Não envia nada a serviço externo e não afirma estado de dados que não verificou.
 */
export function ErrorScreen({ onRetry, onHome, detail }: ErrorScreenProps) {
  const palette = appThemeTokens[useColorScheme() === "dark" ? "dark" : "light"];
  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.wrap}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[typography.title, { color: palette.text }]}>Algo deu errado nesta tela</Text>
        <Text style={[typography.body, styles.description, { color: palette.textSecondary }]}>
          Ocorreu um erro inesperado ao mostrar esta tela. Você pode tentar de novo ou voltar à Biblioteca.
        </Text>
        {detail ? <Text selectable style={[typography.caption, styles.detail, { color: palette.textSecondary, borderColor: palette.border }]}>{detail}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tentar de novo" onPress={onRetry} android_ripple={{ color: palette.surfaceSecondary }}
            style={[styles.button, { backgroundColor: palette.accent, borderColor: palette.accent }]}>
            <Text style={[typography.label, { color: palette.onAccent }]}>Tentar de novo</Text>
          </Pressable>
          {onHome ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar à Biblioteca" onPress={onHome} android_ripple={{ color: palette.surfaceSecondary }}
              style={[styles.button, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[typography.label, { color: palette.text }]}>Voltar à Biblioteca</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", padding: space.xl },
  content: { width: "100%", maxWidth: 520, alignSelf: "center", gap: space.md },
  description: { marginBottom: space.xs },
  detail: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  button: { minHeight: touchTarget, paddingHorizontal: space.xl, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
