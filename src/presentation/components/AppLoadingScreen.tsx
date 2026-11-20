import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

export interface LoadingQuote { lines: readonly string[]; author: string; source: string }

/**
 * Frases da tela de carregamento. Pedido do dono em 18/11/2026: "uma frase bem bonita de algum livro, contextualizada no projeto";
 * em 19/11/2026: "busca mais algumas, pra ir randomizando quando abre o app". Só autores em domínio público e trechos canônicos de
 * obras identificadas; a segunda estrofe de Castro Alves foi conferida no texto de Espumas Flutuantes (1870).
 */
export const LOADING_QUOTES: readonly LoadingQuote[] = [
  { lines: ["O livro caindo n'alma", "É germe — que faz a palma,", "É chuva — que faz o mar."], author: "Castro Alves", source: "O livro e a América" },
  { lines: ["Oh! bendito o que semeia", "Livros... livros à mão cheia...", "E manda o povo pensar!"], author: "Castro Alves", source: "O livro e a América" },
  { lines: ["O meu fim evidente era atar as duas pontas da vida,", "e restaurar na velhice a adolescência."], author: "Machado de Assis", source: "Dom Casmurro" },
  { lines: ["Valeu a pena? Tudo vale a pena", "Se a alma não é pequena."], author: "Fernando Pessoa", source: "Mar Português" },
  { lines: ["O poeta é um fingidor.", "Finge tão completamente", "Que chega a fingir que é dor", "A dor que deveras sente."], author: "Fernando Pessoa", source: "Autopsicografia" },
  { lines: ["Última flor do Lácio, inculta e bela,", "És, a um tempo, esplendor e sepultura"], author: "Olavo Bilac", source: "Língua Portuguesa" },
  { lines: ["Minha terra tem palmeiras,", "Onde canta o Sabiá;", "As aves, que aqui gorjeiam,", "Não gorjeiam como lá."], author: "Gonçalves Dias", source: "Canção do Exílio" },
  { lines: ["Amor é fogo que arde sem se ver;", "É ferida que dói, e não se sente"], author: "Luís de Camões", source: "Soneto" },
];

/** Uma frase por abertura do app: sorteada uma vez quando o app carrega, a mesma no carregamento e no "Continuar". */
export function pickLoadingQuote(random: () => number = Math.random): LoadingQuote {
  return LOADING_QUOTES[Math.min(LOADING_QUOTES.length - 1, Math.floor(random() * LOADING_QUOTES.length))];
}
export const LOADING_QUOTE: LoadingQuote = pickLoadingQuote();

/**
 * Tela de carregamento do Aldus: mesma cor da abertura nativa (azul-noite), para a troca não piscar; medalha, nome e a frase.
 * Usa cores fixas porque aparece antes do tema do app estar disponível. Com `onContinue` (app pronto), o indicador vira o botão
 * "Continuar": pedido do dono em 18/11/2026, a frase sumia rápido demais para ser lida.
 */
export function AppLoadingScreen({ onContinue }: { onContinue?: () => void } = {}) {
  return (
    <View accessibilityLabel={onContinue ? undefined : "Abrindo o Aldus"} style={styles.screen}>
      <Image source={require("../../../assets/brand/medalha-noite.png")} style={styles.medal} accessibilityIgnoresInvertColors accessible={false} />
      <Text style={styles.name}>Aldus</Text>
      <View style={styles.quote} accessibilityRole="text" accessibilityLabel={`${LOADING_QUOTE.lines.join(" ")} ${LOADING_QUOTE.author}, ${LOADING_QUOTE.source}.`}>
        <Text style={styles.mark}>“</Text>
        {LOADING_QUOTE.lines.map(line => <Text key={line} style={styles.line}>{line}</Text>)}
        <Text style={styles.credit}>{`${LOADING_QUOTE.author} · ${LOADING_QUOTE.source}`}</Text>
      </View>
      {onContinue ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Continuar" onPress={onContinue} android_ripple={{ color: "#2B2D45" }} style={styles.continue}>
          <Text style={styles.continueText}>Continuar</Text>
        </Pressable>
      ) : <ActivityIndicator color="#E59A76" style={styles.spinner} />}
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
  continue: { marginTop: 36, minHeight: 48, minWidth: 180, paddingHorizontal: 28, borderRadius: 24, borderWidth: 1, borderColor: "#E59A76", alignItems: "center", justifyContent: "center" },
  continueText: { color: "#EFE6D6", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
});
