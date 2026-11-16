import { useLocalSearchParams } from "expo-router";
import { SafeAreaView, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";

const providers = { biblion: { title: "BibliON", url: "https://www.biblion.org.br/" }, mec: { title: "MEC Livros", url: "https://plataformaintegrada.mec.gov.br/" } } as const;
export default function ServiceWebView() { const { palette } = useAppTheme(); const { provider } = useLocalSearchParams<{ provider: string }>(); const service = providers[provider as keyof typeof providers]; return <AuthGuard>{!service ? <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}><Text style={{ color: palette.text }}>Serviço não encontrado.</Text></SafeAreaView> : <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}><Text style={[styles.title, { color: palette.text }]}>{service.title}</Text><WebView source={{ uri: service.url }} startInLoadingState style={styles.webview} /></SafeAreaView>}</AuthGuard>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, title: { paddingHorizontal: 18, paddingVertical: 14, fontWeight: "700", fontSize: 18 }, webview: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" } });
