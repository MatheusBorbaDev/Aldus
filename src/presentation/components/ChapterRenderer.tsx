import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import RenderHTML from "react-native-render-html";
import { Chapter } from "@/src/domain/types/reader";
import { useReaderSettings } from "@/src/presentation/contexts/ReaderSettingsContext";
import { sanitizeBookHtml } from "@/src/domain/reader/sanitizeBookHtml";

// Conteúdo do livro é entrada não confiável: o mesmo filtro do documento do Reader, e links não abrem outros apps.
const bookLinks = { a: { onPress: () => undefined } };

interface Props { chapter: Chapter; }
export function ChapterRenderer({ chapter }: Props) {
  const { width } = useWindowDimensions();
  const { palette, fontFamily, fontSize } = useReaderSettings();
  return <View style={[styles.chapter, { borderBottomColor: palette.separator }]}><RenderHTML contentWidth={width} source={{ html: sanitizeBookHtml(chapter.html) }} renderersProps={bookLinks} tagsStyles={{ body: { color: palette.text, fontFamily, fontSize, lineHeight: fontSize * 1.65 }, h1: { color: palette.text, fontFamily, fontSize: fontSize + 10, marginBottom: 18 }, h2: { color: palette.text, fontFamily, fontSize: fontSize + 4, marginTop: 12 }, p: { marginBottom: 16 } }} /></View>;
}
const styles = StyleSheet.create({ chapter: { paddingBottom: 42, marginBottom: 32, borderBottomWidth: StyleSheet.hairlineWidth } });
