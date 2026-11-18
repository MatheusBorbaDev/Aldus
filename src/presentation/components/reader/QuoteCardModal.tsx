import { useCallback, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  buildQuoteCardSpec, QUOTE_CARD_FORMATS, QUOTE_CARD_TEMPLATES, quoteCardColors, quoteCardCover, QuoteCardFormat, QuoteCardTemplate, validateQuoteForCard,
} from "@/src/domain/reader/quoteCard";
import { QuoteCardCanvas } from "@/src/presentation/components/reader/QuoteCardCanvas";
import { shareQuoteCard } from "@/src/presentation/services/shareQuoteCard";
import { AppPaletteName, ReaderPalette } from "@/src/theme/tokens";

/**
 * Card de trecho para Stories, post e X (Fase C, 16/11/2026; folha redesenhada em 18/11/2026). Sobe de baixo com a prévia grande;
 * modelos em bolinhas, formato num seletor, título e autor, capa e capítulo ocultáveis (capa ligada por padrão, decisão do dono) e
 * um botão só. A marca Aldus vai sempre (decisão do dono). Envio pela folha do sistema (Android) ou pelo navegador (site). Só o
 * trecho sai; o arquivo do livro nunca.
 */
export function QuoteCardModal({ quote, title, author, cover = null, chapter = null, paletteName, palette, onClose }: {
  quote: string; title: string | null; author: string | null;
  /** Capa já guardada do livro (imagem embutida); outra forma é tratada como "sem capa". */
  cover?: string | null; chapter?: string | null;
  paletteName: AppPaletteName; palette: ReaderPalette; onClose: () => void;
}) {
  const [format, setFormat] = useState<QuoteCardFormat>("story");
  const [template, setTemplate] = useState<QuoteCardTemplate>("paper");
  const [showBook, setShowBook] = useState(true);
  const [showCover, setShowCover] = useState(true);
  const [showChapter, setShowChapter] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const checked = validateQuoteForCard(quote);
  const usableCover = quoteCardCover(cover);
  const usableChapter = chapter && chapter.trim() ? chapter : null;
  const spec = useMemo(() => checked.ok ? buildQuoteCardSpec({ quote, title, author, showBook, format, template, paletteName, cover: usableCover, showCover, chapter: usableChapter, showChapter }) : null,
    [checked.ok, quote, title, author, showBook, format, template, paletteName, usableCover, showCover, usableChapter, showChapter]);
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

  const toggle = (label: string, text: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={styles.toggle}>
      <Text style={{ color: palette.text, flex: 1, fontSize: 15 }}>{text}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} thumbColor={value ? palette.accent : palette.panel} trackColor={{ false: palette.separator, true: palette.accent }} />
    </View>
  );
  const carries = [showBook && (title || author) ? "o título e o autor" : null, showCover && usableCover ? "a capa" : null, showChapter && usableChapter ? "o capítulo" : null].filter(Boolean) as string[];
  const carriesText = carries.length ? `, ${carries.length > 1 ? `${carries.slice(0, -1).join(", ")} e ${carries.at(-1)}` : carries[0]}` : "";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.panel, borderColor: palette.separator }]}>
          <View style={[styles.grab, { backgroundColor: palette.separator }]} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Compartilhar trecho</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={styles.close}>
              <Text style={{ color: palette.secondaryText, fontSize: 20 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {!checked.ok ? <Text accessibilityRole="alert" style={{ color: palette.text, lineHeight: 21 }}>{checked.message}</Text> : <>
              <View accessibilityLabel={`Prévia do card: ${checked.quote}`} style={[styles.preview, { aspectRatio: size.width / size.height, borderColor: palette.separator, backgroundColor: palette.background }]}>
                {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
                  : <Text style={{ color: palette.secondaryText }}>{problem ?? "Desenhando o card…"}</Text>}
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Modelo" style={styles.templates}>
                {QUOTE_CARD_TEMPLATES.map(item => {
                  const selected = template === item.value, colors = quoteCardColors(item.value, paletteName);
                  return <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: selected }} onPress={() => change(setTemplate)(item.value)} style={styles.templateTarget}>
                    <View style={[styles.swatch, { backgroundColor: colors.background, borderColor: selected ? palette.accent : palette.separator, borderWidth: selected ? 3 : 1 }]}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Aa</Text>
                    </View>
                    <Text style={{ color: selected ? palette.text : palette.secondaryText, fontSize: 11, fontWeight: selected ? "700" : "500" }}>{item.label}</Text>
                  </Pressable>;
                })}
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Formato" style={[styles.segments, { borderColor: palette.separator }]}>
                {QUOTE_CARD_FORMATS.map(item => {
                  const selected = format === item.value;
                  return <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: selected }} onPress={() => change(setFormat)(item.value)}
                    style={[styles.segment, { backgroundColor: selected ? palette.background : "transparent", borderColor: selected ? palette.accent : "transparent" }]}>
                    <Text numberOfLines={1} style={{ color: selected ? palette.accent : palette.text, fontWeight: selected ? "700" : "500", fontSize: 13 }}>{item.label}</Text>
                  </Pressable>;
                })}
              </View>
              {toggle("Mostrar título e autor", "Título e autor", showBook, change(setShowBook))}
              {usableCover ? toggle("Mostrar capa", "Capa do livro", showCover, change(setShowCover)) : null}
              {usableChapter ? toggle("Mostrar capítulo", "Capítulo", showChapter, change(setShowChapter)) : null}
              <Text style={{ color: palette.secondaryText, fontSize: 13, lineHeight: 19 }}>{`A imagem leva só este trecho${carriesText}. O arquivo do livro nunca é enviado.`}</Text>
            </>}
          </ScrollView>
          {checked.ok ? <View style={[styles.footer, { borderTopColor: palette.separator }]}>
            {message ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{message}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar imagem" accessibilityState={{ disabled: !image || sharing }} disabled={!image || sharing} onPress={() => void share()}
              style={[styles.primary, { backgroundColor: palette.accent, opacity: !image || sharing ? 0.5 : 1 }]}>
              <Text style={{ color: palette.onAccent, fontWeight: "700", fontSize: 15 }}>{sharing ? "Abrindo…" : "Compartilhar imagem"}</Text>
            </Pressable>
          </View> : null}
          {spec ? <QuoteCardCanvas spec={spec} onImage={onImage} onError={onError} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { maxHeight: "94%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, overflow: "hidden", width: "100%", maxWidth: 560, alignSelf: "center" },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 6 },
  title: { flex: 1, fontSize: 18, fontWeight: "700" },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 18, paddingBottom: 22, gap: 12 },
  preview: { alignSelf: "center", width: "56%", maxWidth: 270, borderWidth: 1, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  templates: { flexDirection: "row", justifyContent: "center", gap: 10, flexWrap: "wrap" },
  templateTarget: { minWidth: 56, minHeight: 44, alignItems: "center", gap: 4 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  segments: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 44, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  toggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  primary: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 2 },
});
