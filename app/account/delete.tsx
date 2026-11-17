import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { AuthButton, AuthError, AuthForm, AuthInput } from "@/src/presentation/components/AuthForm";
import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { useAuth } from "@/src/presentation/contexts/AuthContext";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { requireSupabase } from "@/src/data/remote/supabase";
import { requestAccountDeletion } from "@/src/data/remote/accountDeletionService";
import { ACCOUNT_DELETE_CONFIRMATION, ACCOUNT_DELETE_KEEPS, ACCOUNT_DELETE_REMOVES, confirmationMatches } from "@/src/domain/account/accountDeletion";

/**
 * Excluir conta (17/11/2026). Dois passos: primeiro o que sai e o que fica; depois digitar a frase de confirmação.
 * Só sai da conta neste aparelho depois que o servidor confirma a exclusão.
 */
export default function DeleteAccount() {
  const { user, signOut } = useAuth();
  const { palette } = useAppTheme();
  const [step, setStep] = useState<"review" | "confirm">("review");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = (items: readonly string[]) => items.map(item => <Text key={item} style={{ color: palette.text, lineHeight: 21 }}>{"• " + item}</Text>);

  const submit = async () => {
    if (!confirmationMatches(typed) || busy) return;
    setBusy(true); setError(null);
    try {
      await requestAccountDeletion(requireSupabase(), typed);
      setTyped("");
      try { await signOut(); }
      catch { setError("Sua conta foi excluída, mas a sessão continua aberta neste aparelho. Feche e abra o app para sair."); return; }
      router.replace({ pathname: "/auth/login", params: { notice: "account-deleted" } } as never);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível excluir a conta.");
    } finally { setBusy(false); }
  };

  return <AuthGuard><AuthForm title="Excluir conta" subtitle={user?.email ? `Conta ${user.email}` : "Sua conta no Aldus"}>
    {step === "review" ? <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={{ color: palette.text, fontWeight: "700", fontSize: 16 }}>O que é apagado para sempre</Text>
      {list(ACCOUNT_DELETE_REMOVES)}
      <Text accessibilityRole="header" style={{ color: palette.text, fontWeight: "700", fontSize: 16, marginTop: 8 }}>O que não é apagado</Text>
      {list(ACCOUNT_DELETE_KEEPS)}
      <Text style={{ color: palette.secondaryText, lineHeight: 21 }}>Não dá para desfazer. Se quiser guardar suas notas, exporte-as antes no painel de grifos de cada livro.</Text>
      <AuthButton title="Continuar para a exclusão" icon="trash-outline" onPress={() => setStep("confirm")} />
      <AuthButton title="Manter minha conta" secondary onPress={() => router.back()} />
    </View> : <View style={{ gap: 10 }}>
      <Text style={{ color: palette.text, lineHeight: 21 }}>{`Para confirmar, digite ${ACCOUNT_DELETE_CONFIRMATION}.`}</Text>
      <AuthInput label="Frase de confirmação" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoComplete="off" />
      <AuthError message={error} />
      <AuthButton title={busy ? "Excluindo…" : "Confirmar: excluir minha conta"} disabled={busy || !confirmationMatches(typed)} onPress={() => void submit()} />
      <AuthButton title="Voltar" secondary disabled={busy} onPress={() => { setStep("review"); setTyped(""); setError(null); }} />
    </View>}
  </AuthForm></AuthGuard>;
}
