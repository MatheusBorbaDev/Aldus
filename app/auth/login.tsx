import { useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AuthButton, AuthDivider, AuthError, AuthForm, AuthInput, AuthLegalNotice, AuthLink } from "@/src/presentation/components/AuthForm";
import { loginWithGoogle, loginWithIdentifier } from "@/src/data/remote/authService";
import { useAuth } from "@/src/presentation/contexts/AuthContext";
import { authDiagnostic, beginAuthDiagnostic, finishAuthDiagnostic } from "@/src/utils/authDiagnostics";

export default function Login() {
  const { session, profile } = useAuth();
  const { palette } = useAppTheme();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (session && profile) return <Redirect href="/" />;
  const run = async () => {
    const operationId = beginAuthDiagnostic();
    authDiagnostic("LOGIN_ATTEMPT_STARTED", { operationId, session: !!session, previousUuid: session?.user.id, result: "started" });
    setBusy(true); setError(null);
    try { await loginWithIdentifier(identifier, password, operationId); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível entrar.");
      authDiagnostic("LOGIN_UI_RESULT", { operationId, result: "error", stage: "credentials", errorShown: true, navigationExecuted: false });
      finishAuthDiagnostic(operationId); setBusy(false); return;
    }
    // Authentication has completed. A router failure must not be attributed to credentials.
    try {
      router.replace("/");
      authDiagnostic("LOGIN_UI_RESULT", { operationId, result: "success", stage: "navigation", errorShown: false, navigationExecuted: true });
    } catch {
      setError("A autenticação foi concluída, mas não foi possível abrir o aplicativo. Tente continuar.");
      authDiagnostic("LOGIN_UI_RESULT", { operationId, result: "error", stage: "navigation", errorShown: true, navigationExecuted: false });
    } finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError(null);
    try { await loginWithGoogle(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Google indisponível."); }
    finally { setBusy(false); }
  };
  return <AuthForm title="Bem-vindo" subtitle="Entre para continuar sua leitura.">
    {notice === "account-deleted" ? <Text accessibilityRole="alert" style={{ color: palette.text, lineHeight: 21 }}>Sua conta foi excluída. As cópias guardadas neste aparelho continuam aqui até você remover o app.</Text> : null}
    <AuthInput label="Email ou nome de usuário" icon="person-outline" value={identifier} onChangeText={setIdentifier} autoComplete="username" />
    <AuthInput label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
    <AuthError message={error} />
    <AuthButton title={busy ? "Aguarde…" : "Entrar"} disabled={busy} onPress={() => void run()} />
    <AuthLink title="Esqueceu sua senha?" href="/auth/forgot-password" />
    <AuthDivider />
    <AuthButton title="Continuar com Google" icon="logo-google" secondary disabled={busy} onPress={() => void google()} />
    <AuthLink title="Não tem conta? Criar conta" href="/auth/signup" />
    <AuthLegalNotice intro="Antes de entrar, consulte os documentos aplicáveis:" />
  </AuthForm>;
}
