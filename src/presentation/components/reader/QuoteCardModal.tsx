import { useCallback, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  buildQuoteCardSpec, QUOTE_CARD_FORMATS, QUOTE_CARD_TEMPLATES, QuoteCardFormat, QuoteCardTemplate, validateQuoteForCard,
} from "@/src/domain/reader/quoteCard";
import { QuoteCardCanvas } from "@/src/presentation/components/reader/QuoteCardCanvas";
import { shareQuoteCard } from "@/src/presentation/services/shareQuoteCard";
import { AppPaletteName, ReaderPalette } from "@/src/theme/tokens";

/**
 * Card de trecho para Stories, post e X (Fase C, 16/11/2026). A pessoa escolhe modelo e formato, liga ou desliga título/autor e
 * a marca Aldus, vê a prévia e envia a imagem pela folha do sistema (Android) ou pelo navegador (site). Só o trecho sai.
 */
export function QuoteCardModal({ quote, title, author, paletteName, palette, onClose }: {
  quote: string; title: string | null; author: string | null; paletteName: AppPaletteName; palette: ReaderPalette; onClose: () => void;
}) {
  const [format, setFormat] = useState<QuoteCardFormat>("story");
  const [template, setTemplate] = useState<QuoteCardTemplate>("paper");
  const [showBook, setShowBook] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const checked = validateQuoteForCard(quote);
  const spec = useMemo(() => checked.ok ? buildQuoteCardSpec({ quote, title, author, showBook, showBrand, format, template, paletteName }) : null,
    [checked.ok, quote, title, author, showBook, showBrand, format, template, paletteName]);
  const size = QUOTE_CARD_FORMATS.find(item => item.value === format) ?? QUOTE_CARD_FORMATS[0];
  const onImage = useCallback((dataUrl: string) => { setImage(dataUrl); setProblem(null); }, []);
  const onError = useCallback((text: string) => { setImage(null); setProblem(text); }, []);
  const change = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setImage(null); setMessage(null); };

  const share = async () => {
    if (!image || sharing) return;
    setSharing(true); setMessage(null);
    try {
      const result = await shareQuoteCard(image, `aldus-trecho-${format}.jpg`);
      setMessage(result === "downloaded" ? "Imagem baixada. Envie pelo app que preferir." : result === "unavailable" ? "O compartilhamento não está disponível neste aparelho." : null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível compartilhar a imagem."); }
    finally { setSharing(false); }
  };

  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }} onPress={onPress}
      style={[styles.chip, { borderColor: selected ? palette.accent : palette.separator, borderWidth: selected ? 2 : 1 }]}>
      <Text style={{ color: palette.text, fontWeight: selected ? "700" : "500" }}>{selected ? "✓ " : ""}{label}</Text>
    </Pressable>
  );
  const toggle = (label: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={styles.row}>
      <Text style={{ color: palette.text, flex: 1 }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} thumbColor={value ? palette.accent : palette.panel} trackColor={{ false: palette.separator, true: palette.accent }} />
    </View>
  );
  const button = (label: string, onPress: () => void, primary = false, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.action, { borderColor: primary ? palette.accent : palette.separator, backgroundColor: primary ? palette.accent : "transparent", opacity: disabled ? 0.5 : 1 }]}>
      <Text style={{ color: primary ? palette.onAccent : palette.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { backgroundColor: palette.panel, borderColor: palette.separator }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Compartilhar trecho</Text>
            {!checked.ok ? <Text accessibilityRole="alert" style={{ color: palette.text, lineHeight: 21 }}>{checked.message}</Text> : <>
              <View accessibilityLabel={`Prévia do card: ${checked.quote}`} style={[styles.preview, { aspectRatio: size.width / size.height, borderColor: palette.separator }]}>
                {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
                  : <Text style={{ color: palette.secondaryText }}>{problem ?? "Desenhando o card…"}</Text>}
              </View>
              <Text style={[styles.label, { color: palette.secondaryText }]}>Modelo</Text>
              <View style={styles.wrap}>{QUOTE_CARD_TEMPLATES.map(item => chip(item.label, template === item.value, () => change(setTemplate)(item.value)))}</View>
              <Text style={[styles.label, { color: palette.secondaryText }]}>Formato</Text>
              <View style={styles.wrap}>{QUOTE_CARD_FORMATS.map(item => chip(item.label, format === item.value, () => change(setFormat)(item.value)))}</View>
              {toggle("Mostrar título e autor", showBook, change(setShowBook))}
              {toggle("Mostrar a marca Aldus", showBrand, change(setShowBrand))}
              <Text style={{ color: palette.secondaryText, fontSize: 13, lineHeight: 19 }}>
                {`A imagem leva só este trecho${showBook ? ", o título e o autor" : ""}. O arquivo do livro nunca é enviado.`}
              </Text>
              {message ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{message}</Text> : null}
              {button(sharing ? "Abrindo…" : "Compartilhar imagem", () => void share(), true, !image || sharing)}
            </>}
            {button("Fechar", onClose)}
          </ScrollView>
          {spec ? <QuoteCardCanvas spec={spec} onImage={onImage} onError={onError} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 16 },
  panel: { maxHeight: "92%", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  content: { padding: 18, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  preview: { alignSelf: "center", width: "62%", maxWidth: 260, borderWidth: 1, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  label: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: "center" },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  action: { minHeight: 48, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
});
