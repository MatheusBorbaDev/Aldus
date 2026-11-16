import { useLocalSearchParams } from "expo-router";
import { SafeAreaView, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
export default function WebReader() { const { palette } = useAppTheme(); const { url, title } = useLocalSearchParams<{ url: string; title?: string }>(); return <AuthGuard>{!url ? <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}><Text style={{ color: palette.text }}>Link de leitura não encontrado.</Text></SafeAreaView> : <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}><Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{title ?? "Leitor online"}</Text><WebView source={{ uri: url }} startInLoadingState style={styles.webview} /></SafeAreaView>}</AuthGuard>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, title: { padding: 16, fontWeight: "700" }, webview: { flex: 1 }, center: { flex: 1, justifyContent: "center", alignItems: "center" } });
