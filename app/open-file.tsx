import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { appDependencies } from "@/src/presentation/services/dependencies";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { useLibraryStore } from "@/src/presentation/stores/libraryStore";
import { incomingFileName, incomingFileUri } from "@/src/domain/library/incomingFile";
import { AppText, Button, EmptyState, space } from "@/src/ui";

/** Importa o PDF/EPUB recebido de outro app ("Abrir com Aldus") e abre no Reader. Onda C3. */
export default function OpenFile() {
  return <AuthGuard><OpenFileContent /></AuthGuard>;
}

function OpenFileContent() {
  const { uri: raw } = useLocalSearchParams<{ uri?: string }>();
  const { palette } = useAppTheme();
  const uri = incomingFileUri(typeof raw === "string" ? raw : null);
  const [error, setError] = useState<string | null>(uri ? null : "Este arquivo não pode ser aberto pelo Aldus.");
  const started = useRef(false);
  useEffect(() => {
    if (!uri || started.current) return;
    started.current = true;
    const controller = new AbortController();
    void appDependencies.localBookImporter.import({ uri, name: incomingFileName(uri), mimeType: null, size: null }, {
      operationId: `open-with-${Date.now()}`,
      signal: controller.signal,
      onPhase: () => undefined,
    }).then(async book => {
      await useLibraryStore.getState().refresh().catch(() => undefined);
      if (!controller.signal.aborted) router.replace({ pathname: "/reader/[bookId]", params: { bookId: book.id } });
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error && failure.message ? failure.message : "Não foi possível importar este arquivo.");
    });
    return () => controller.abort();
  }, [uri]);
  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      {error ? (
        <EmptyState icon="alert-circle-outline" title="Não foi possível abrir o livro" description={error}>
          <Button label="Ir para a Biblioteca" variant="primary" onPress={() => router.replace("/library" as never)} />
        </EmptyState>
      ) : (
        <View accessibilityLiveRegion="polite" style={styles.center}>
          <ActivityIndicator color={palette.accent} />
          <AppText variant="body" align="center">Importando para a sua Biblioteca…</AppText>
          <AppText variant="caption" tone="secondary" align="center">{uri ? incomingFileName(uri) : ""}</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "center" },
  center: { alignItems: "center", gap: space.sm, padding: space.xxl },
});
