import { useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PdfReflowPreview } from "@/src/data/local/pdfReflowPreview";
import { previewResumeText } from "@/src/domain/reader/reflowPreviewAnchor";
import type { ReaderPalette } from "@/src/theme/tokens";

interface Props {
  preview: PdfReflowPreview;
  palette: ReaderPalette;
  fontSize: number;
  lineHeight: number;
  progressLabel: string;
  topInset: number;
  bottomInset: number;
  /** The paragraph at the top of the screen (null at the opening): where the complete book continues. Never saved. */
  onResumeText: (text: string | null) => void;
  onClose: () => void;
}

const SERIF = Platform.OS === "web" ? "Georgia, 'Times New Roman', serif" : "serif";

/**
 * The first pages of a Leitura Livre while the rest is prepared (18/11/2026). Plain text with the book's colors and size: no pages,
 * highlights, bookmarks or saved position; the complete reader replaces it and continues from the paragraph at the top.
 */
export function PdfReflowPreviewReader({ preview, palette, fontSize, lineHeight, progressLabel, topInset, bottomInset, onResumeText, onClose }: Props) {
  const tops = useRef<number[]>([]);
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onResumeText(previewResumeText(preview.blocks, tops.current, event.nativeEvent.contentOffset.y));
  };
  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: topInset }]} accessibilityViewIsModal>
      <View style={[styles.header, { borderBottomColor: palette.separator }]}>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Início do livro</Text>
          <Text style={[styles.status, { color: palette.secondaryText }]} accessibilityLiveRegion="polite">{progressLabel}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar à preparação da leitura livre" onPress={onClose} style={styles.close} hitSlop={8}>
          <Text style={[styles.closeText, { color: palette.accent }]}>Voltar</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 32 }]}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
        scrollEventThrottle={120}
      >
        {preview.blocks.map((block, index) => (
          <Text
            key={index}
            onLayout={event => { tops.current[index] = event.nativeEvent.layout.y; }}
            accessibilityRole={block.type === "heading" ? "header" : undefined}
            style={block.type === "heading"
              ? [styles.heading, { color: palette.text, fontSize: Math.round(fontSize * (block.level === 1 ? 1.35 : 1.15)), lineHeight: Math.round(fontSize * 1.6) }]
              : [styles.paragraph, { color: palette.text, fontSize, lineHeight: Math.round(fontSize * lineHeight) }]}
          >
            {block.text}
          </Text>
        ))}
        <Text style={[styles.end, { color: palette.secondaryText }]}>
          Fim do trecho disponível ({preview.pageCount} primeiras páginas). Quando a preparação terminar, o livro completo abre no ponto em que você estiver.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, zIndex: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "600" },
  status: { fontSize: 13, marginTop: 2 },
  close: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 8 },
  closeText: { fontSize: 15, fontWeight: "600" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 20, width: "100%", maxWidth: 680, alignSelf: "center" },
  heading: { fontFamily: SERIF, fontWeight: "700", marginTop: 12, marginBottom: 12 },
  paragraph: { fontFamily: SERIF, marginBottom: 12 },
  end: { fontSize: 14, fontStyle: "italic", marginTop: 20, textAlign: "center" },
});
