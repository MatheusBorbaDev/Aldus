import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

/**
 * Frase da tela de carregamento (pedido do dono em 18/11/2026: "uma frase bem bonita de algum livro, contextualizada no projeto").
 * Castro Alves, "O livro e a América", em Espumas Flutuantes (1870): obra em domínio público.
 */
export const LOADING_QUOTE = {
  lines: ["O livro caindo n'alma", "É germe — que faz a palma,", "É chuva — que faz o mar."],
  author: "Castro Alves",
  source: "O livro e a América",
} as const;

/**
 * Tela de carregamento do Aldus: mesma cor da abertura nativa (azul-noite), para a troca não piscar; medalha, nome e a frase.
 * Usa cores fixas porque aparece antes do tema do app estar disponível.
 */
export function AppLoadingScreen() {
  return (
    <View accessibilityLabel="Abrindo o Aldus" style={styles.screen}>
      <Image source={require("../../../assets/brand/medalha-noite.png")} style={styles.medal} accessibilityIgnoresInvertColors accessible={false} />
      <Text style={styles.name}>Aldus</Text>
      <View style={styles.quote} accessibilityRole="text" accessibilityLabel={`${LOADING_QUOTE.lines.join(" ")} ${LOADING_QUOTE.author}, ${LOADING_QUOTE.source}.`}>
        <Text style={styles.mark}>“</Text>
        {LOADING_QUOTE.lines.map(line => <Text key={line} style={styles.line}>{line}</Text>)}
        <Text style={styles.credit}>{`${LOADING_QUOTE.author} · ${LOADING_QUOTE.source}`}</Text>
      </View>
      <ActivityIndicator color="#E59A76" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1B1C30", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  medal: { width: 96, height: 96 },
  name: { color: "#EFE6D6", fontFamily: "serif", fontSize: 30, marginTop: 14, letterSpacing: 0.5 },
  quote: { marginTop: 36, alignItems: "center", maxWidth: 340 },
  mark: { color: "#E59A76", fontFamily: "serif", fontSize: 40, lineHeight: 40, height: 28 },
  line: { color: "#EFE6D6", fontFamily: "serif", fontStyle: "italic", fontSize: 18, lineHeight: 27, textAlign: "center" },
  credit: { color: "#E59A76", fontSize: 12, letterSpacing: 1.5, marginTop: 14, textAlign: "center" },
  spinner: { marginTop: 36 },
});
