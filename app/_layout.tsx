import { router, Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import { ErrorScreen } from "@/src/ui/ErrorScreen";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { AppState, DimensionValue, Linking, Platform, StatusBar, StyleSheet, useWindowDimensions, View } from "react-native";
import { addNetworkStateListener } from 'expo-network';
import { appDependencies } from '@/src/presentation/services/dependencies';
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ReaderSettingsProvider } from "@/src/presentation/contexts/ReaderSettingsContext";
import { AppThemeProvider, useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AuthProvider, useAuth } from "@/src/presentation/contexts/AuthContext";
import { authDiagnostic, correlatedAuthDiagnostic } from "@/src/utils/authDiagnostics";
import { useReviewReminderNavigation } from "@/src/presentation/hooks/useReviewReminderNavigation";
import { AppLoadingScreen } from "@/src/presentation/components/AppLoadingScreen";
import { ReleaseNotesModal } from "@/src/presentation/components/ReleaseNotesModal";
import { nativeAuthCallbacks } from '@/src/data/remote/nativeAuthCallback';

/**
 * Fronteira de erro da raiz (BUG 14): uma exceção de renderização em qualquer tela mostra uma
 * tela de recuperação em vez de derrubar o app. Fica fora dos providers, por isso ErrorScreen
 * não depende de tema/Auth. Não registra nem envia o erro; o detalhe só aparece em desenvolvimento.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ErrorScreen
      detail={__DEV__ ? error.message : undefined}
      onRetry={() => { void retry(); }}
      onHome={() => { router.replace("/library"); void retry(); }}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  useEffect(() => {
    if (Platform.OS !== 'web') return nativeAuthCallbacks.start(Linking);
  }, []);

  if (!fontsLoaded && !fontError) {
    return <AppLoadingScreen />;
  }

  return (
    <>
      <Head><title>Aldus Reader</title></Head>
      <AppThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <ReaderSettingsProvider>
              <AppShell />
            </ReaderSettingsProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </AppThemeProvider>
    </>
  );
}

function AppShell() {
  useReviewReminderNavigation();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { palette, resolvedTheme } = useAppTheme();
  const { loading, session, profile } = useAuth();
  const publicLanding = Platform.OS === 'web' && (!segments.length || String(segments[0]) === 'index');
  // Preserve the tested Reader viewport; other task screens own their responsive width.
  const usePhoneFrame = Platform.OS === "web" && width > 480 && String(segments[0]) === 'reader';
  const appReady = !loading && !!session && !!profile?.username && profile.account_status === "active";
  // Uma vez por abertura do app: a frase de abertura espera o toque em Continuar.
  const [welcomed, setWelcomed] = useState(false);
  useEffect(()=>{
    if(!appReady||publicLanding)return;
    const sync=appDependencies.librarySync;sync.start();
    const foreground=AppState.addEventListener('change',state=>{if(state==='active')sync.schedule(0);});
    const network=addNetworkStateListener(state=>{if(state.isConnected && state.isInternetReachable!==false)sync.schedule();});
    return()=>{foreground.remove();network.remove();sync.stop();};
  },[appReady,publicLanding,session?.user.id]);
  useEffect(() => {
    authDiagnostic("AUTH_GUARD_DECISION", { operationId: correlatedAuthDiagnostic(session?.user.id), correlation: "candidate", guard: "shell", decision: appReady ? "allowed" : "blocked",
      uuid: session?.user.id, session: !!session, profile: !!profile, username: !!profile?.username, accountStatus: profile?.account_status, loading, appReady });
  }, [loading, session, profile, appReady]);

  return (
    <>
      {!publicLanding ? <Head><meta name="robots" content="noindex,nofollow" /></Head> : null}
      <StatusBar barStyle={resolvedTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={palette.background} />
      <View style={usePhoneFrame ? [styles.webBackground, { backgroundColor: palette.background }] : [styles.fill, { backgroundColor: palette.background }]}>
        <View
          style={[
            usePhoneFrame ? styles.phoneFrame : styles.fill,
            usePhoneFrame ? {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 8),
            } : { backgroundColor: palette.background },
          ]}
        >
          {loading && !publicLanding ? <AppLoadingScreen /> :
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="beta" />
              <Stack.Screen name="legal/index" />
              <Stack.Screen name="legal/privacy" />
              <Stack.Screen name="legal/terms" />
              <Stack.Screen name="legal/copyright" />
              <Stack.Screen name="legal/licenses" />
              <Stack.Screen name="legal/data" />
              <Stack.Screen name="legal/about" />
              <Stack.Screen name="legal/version" />
              <Stack.Protected guard={appReady}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="preferences" />
                <Stack.Screen name="sources/index" />
                <Stack.Screen name="sources/[sourceId]" />
                <Stack.Screen name="reader/[bookId]" />
                <Stack.Screen name="reader/web" />
                <Stack.Screen name="study/[deckId]" />
                <Stack.Screen name="decks/[deckId]" />
                <Stack.Screen name="battle" />
                <Stack.Screen name="services/[provider]" />
                <Stack.Screen name="account/index" />
                <Stack.Screen name="account/edit-profile" />
                <Stack.Screen name="account/change-password" />
                <Stack.Screen name="account/delete" />
                <Stack.Screen name="plan/index" />
                <Stack.Screen name="plan/compare" />
                <Stack.Screen name="community" />
                <Stack.Screen name="admin/index" />
              </Stack.Protected>
            </Stack>}
          {/* A frase fica por cima do app já carregado até a pessoa tocar em Continuar (o app, os links e o login seguem por baixo). */}
          {!loading && !publicLanding && !welcomed ? <View style={StyleSheet.absoluteFill}><AppLoadingScreen onContinue={() => setWelcomed(true)} /></View> : null}
          {appReady && !publicLanding && !loading && welcomed ? <ReleaseNotesModal /> : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  webBackground: {
    alignItems: "center",
    height: "100vh" as DimensionValue,
    justifyContent: "center",
  },
  phoneFrame: {
    borderRadius: 30,
    borderWidth: 1,
    elevation: 18,
    height: "90%",
    maxHeight: 900,
    maxWidth: 430,
    overflow: "hidden",
    boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.35)",
    width: "100%",
  },
});
