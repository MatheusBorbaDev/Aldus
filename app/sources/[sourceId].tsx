import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSourceStore } from "@/src/presentation/stores/sourceStore";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { sourceCapabilities } from "@/src/domain/types/sourceCatalog";
import { SourceLibraryScreen, SourceLibraryUnavailable } from "@/src/presentation/components/SourceLibraryScreen";

export default function SourceLibraryRoute() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const { sources, load } = useSourceStore(), { palette } = useAppTheme();
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { void load().catch(() => setError("Não foi possível ler as fontes.")).finally(() => setReady(true)); }, [load]);
  const source = sources.find(item => item.id === sourceId);
  if (!ready) return <View accessibilityLabel="Carregando biblioteca" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.background }}><ActivityIndicator color={palette.accent} /></View>;
  if (error) return <SourceLibraryUnavailable title="Não foi possível abrir a biblioteca" description={error} />;
  if (!source) return <SourceLibraryUnavailable title="Biblioteca não encontrada" description="Biblioteca removida ou não encontrada nesta conta. Os livros importados permanecem na sua biblioteca." />;
  if (!sourceCapabilities(source).supportsCatalog) return <SourceLibraryUnavailable title="Somente pesquisa" description="Este catálogo oferece somente pesquisa, não uma biblioteca completa." />;
  return <SourceLibraryScreen source={source} />;
}
