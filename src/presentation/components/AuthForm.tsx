import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AppText, Button, radius, space, touchTarget, typography } from "@/src/ui";

/**
 * Moldura e controles das telas de entrada (login, cadastro, recuperação, perfil, conta). Só apresentação: nenhuma regra de
 * Auth/OAuth mora aqui. API estável (title/label/onPress) — as telas e `test-auth-flows` dependem dela.
 */
export function AuthForm({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, space.xxxl), paddingBottom: Math.max(insets.bottom, space.xxxl) }]}>
        <View style={styles.column}>
          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: palette.accentSoft }]}><Ionicons name="book-outline" size={24} color={palette.accent} /></View>
            <AppText variant="overline" tone="accent">Aldus Reader</AppText>
          </View>
          <View style={styles.titles}>
            <AppText variant="display" accessibilityRole="header">{title}</AppText>
            {subtitle ? <AppText variant="body" tone="secondary">{subtitle}</AppText> : null}
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </ScrollView>
    </View>
  );
}

export function AuthInput({ label, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, autoComplete, icon, hint }: {
  label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  autoCapitalize?: React.ComponentProps<typeof TextInput>["autoCapitalize"];
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Regra curta exibida sob o campo (ex.: formato do nome de usuário). */
  hint?: string;
}) {
  const { palette } = useAppTheme();
  const [show, setShow] = React.useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.inputBox, { borderColor: palette.border, backgroundColor: palette.input }]}>
        {icon ? <Ionicons name={icon} size={18} color={palette.secondaryText} /> : null}
        {/* Sem placeholder: o rótulo visível já nomeia o campo (repetir confundia campo vazio com preenchido). */}
        <TextInput accessibilityLabel={label} accessibilityHint={hint} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry && !show} keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? "none"} autoComplete={autoComplete} autoCorrect={false} style={[styles.input, typography.body, { color: palette.text }]} />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={show ? "Ocultar senha" : "Mostrar senha"} onPress={() => setShow(!show)} android_ripple={{ color: palette.separator, borderless: true }} style={styles.reveal}>
            <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={palette.secondaryText} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <AppText variant="caption" tone="secondary">{hint}</AppText> : null}
    </View>
  );
}

/** Ação principal (accent) ou secundária (contorno), de largura total. */
export function AuthButton({ title, onPress, disabled, icon, secondary }: { title: string; onPress: () => void; disabled?: boolean; icon?: React.ComponentProps<typeof Ionicons>["name"]; secondary?: boolean }) {
  return <Button label={title} onPress={onPress} disabled={disabled} icon={icon} variant={secondary ? "secondary" : "primary"} block style={styles.button} />;
}

export function AuthLink({ title, href }: { title: string; href: string }) {
  const { palette } = useAppTheme();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(href as never)} android_ripple={{ color: palette.separator }} style={styles.link}>
      <AppText variant="label" tone="accent" align="center">{title}</AppText>
    </Pressable>
  );
}

/** Separador "ou" entre o acesso por senha e o Google. */
export function AuthDivider() {
  const { palette } = useAppTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.rule, { backgroundColor: palette.border }]} />
      <AppText variant="caption" tone="secondary">ou</AppText>
      <View style={[styles.rule, { backgroundColor: palette.border }]} />
    </View>
  );
}

export function AuthLegalNotice({ intro }: { intro: string }) {
  const { palette } = useAppTheme();
  const legal = (title: string, href: string) => (
    <Pressable accessibilityRole="link" onPress={() => router.push(href as never)} android_ripple={{ color: palette.separator }} style={styles.legalLink}>
      <AppText variant="caption" tone="accent" style={styles.underline}>{title}</AppText>
    </Pressable>
  );
  return (
    <View style={styles.legal}>
      <AppText variant="caption" tone="secondary" align="center">{intro}</AppText>
      <View style={styles.legalRow}>
        {legal("Termos de Uso", "/legal/terms")}
        <AppText variant="caption" tone="secondary">e a</AppText>
        {legal("Política de Privacidade", "/legal/privacy")}
      </View>
    </View>
  );
}

/** Erro do formulário: cor de erro e ícone (não só cor), anunciado a leitores de tela. */
export function AuthError({ message }: { message: string | null }) {
  const { palette } = useAppTheme();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.error, { borderColor: palette.danger, backgroundColor: palette.accentSoft }]}>
      <Ionicons name="alert-circle-outline" size={18} color={palette.danger} />
      <AppText variant="bodySmall" style={[styles.errorText, { color: palette.text }]}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: space.xxl },
  column: { width: "100%", maxWidth: 420, alignSelf: "center", gap: space.xxl },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  mark: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  titles: { gap: space.xs },
  body: { gap: space.lg },
  field: { gap: space.xs + 2 },
  inputBox: { minHeight: touchTarget + 4, borderWidth: 1, borderRadius: radius.md, flexDirection: "row", alignItems: "center", paddingLeft: space.md, gap: space.sm },
  input: { flex: 1, minWidth: 0, minHeight: touchTarget, paddingVertical: space.sm, paddingRight: space.md },
  reveal: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  button: { minHeight: touchTarget + 4 },
  link: { minHeight: touchTarget, justifyContent: "center", alignSelf: "center", paddingHorizontal: space.sm },
  divider: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  legal: { alignItems: "center", gap: space.xxs },
  legalRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", columnGap: space.xs },
  legalLink: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: space.xxs },
  underline: { textDecorationLine: "underline", fontWeight: "600" },
  error: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  errorText: { flex: 1, minWidth: 0 },
});
