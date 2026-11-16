import { Ionicons } from "@expo/vector-icons";
import { MotionCuesControl } from "./MotionCuesControl";
import { ReaderSettingsSlider as Slider } from "./ReaderSettingsSlider";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEFAULT_READER_LINE_HEIGHT, DEFAULT_READER_PARAGRAPH_SPACING, useReaderSettings } from "@/src/presentation/contexts/ReaderSettingsContext";
import { defaultPdfReaderSettings, PdfReaderSettings, PdfReadingMode } from "@/src/domain/types/pdfReader";
import { fontFamilies, pdfReaderThemes, readerThemes } from "@/src/theme/tokens";
import { PdfReaderTheme } from "@/src/domain/types/pdfReader";
import { readerUiDiagnostic } from "@/src/utils/readerUiDiagnostics";
import { FOCUS_GOAL_MINUTES } from "@/src/domain/reader/readingSession";
import { PAPER_TEXTURES } from "@/src/domain/reader/paperTexture";
import { PAGE_TURNS } from "@/src/domain/reader/pageTurn";

/**
 * Ajustes de leitura (redesenho, etapa 1). Folha baixa: o texto continua visível atrás para o leitor ver o efeito.
 * - Sempre à mão: tamanho da letra, tema (amostra com a cor real) e brilho.
 * - "Mais ajustes" em três seções: Texto · Página · Conforto (o PDF Original não tem Texto: preserva a tipografia do arquivo).
 * Só apresentação: os valores, limites e padrões são os mesmos; abrir, trocar de seção ou expandir não grava nada nem toca no
 * documento. As seções ficam montadas (display none) para não recriar controles ao navegar.
 */
interface Props {
  visible: boolean;
  panelMode: "appearance" | "contents" | "search";
  onClose: () => void;
  /** "Ler em foco": sem argumento só esconde os controles; com minutos começa uma sessão de foco medida (Fase 2). */
  onReadInFocus?: (minutes?: number | null) => void;
  /** Minutos de foco que faltam (tempo ativo medido) ou null sem foco em andamento. */
  focusMinutesLeft?: number | null;
  onEndFocus?: () => void;
  focusSummaryEnabled?: boolean;
  onFocusSummaryChange?: (value: boolean) => void;
  /** Só Android: abre a tela "Não perturbe" do sistema, sem permissão especial. */
  onOpenDoNotDisturb?: () => void;
  /** Marcos de leitura locais do livro (FASE 5b). */
  onOpenMilestones?: () => void;
  /** Leitura em voz alta (onda C1): começa na página atual; `listening` alterna o botão para "Parar". */
  onListen?: () => void;
  onStopListening?: () => void;
  listening?: boolean;
  pdfMode?: PdfReadingMode;
  pdfSettings?: PdfReaderSettings | null;
  onPdfModeChange?: (mode: PdfReadingMode) => void;
  onPdfSettingsChange?: (settings: PdfReaderSettings) => void;
  /** Falha ao gravar os ajustes do PDF aberto (ver ReaderScreen). */
  pdfSettingsSaveError?: string | null;
  onToggleFullscreen?: () => void;
  pageNumber?: number;
  totalPages?: number;
  onGoToPage?: (pageNumber: number) => void;
  chapterItems?: Array<{ index: number; title: string }>;
  chapterIndex?: number;
  onSelectChapter?: (chapterIndex: number) => void;
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
  onSearch?: () => void;
  searchResult?: boolean | null;
}

type Palette = ReturnType<typeof useReaderSettings>["palette"];
type SectionId = "text" | "page" | "comfort";

const themes = [
  { value: "light", label: "Claro" },
  { value: "paper", label: "Papel" },
  { value: "sepia", label: "Sépia" },
  { value: "dark", label: "Escuro" },
  { value: "black", label: "Preto" },
] as const;
const fonts = [
  { value: "serif", label: "Serifada" },
  { value: "sans", label: "Sem serifa" },
  // Valor interno "dyslexic" mantido: é a chave salva nas preferências existentes.
  { value: "dyslexic", label: "Alta legibilidade (Verdana)" },
] as const;
const sections: Array<{ id: SectionId; label: string }> = [
  { id: "text", label: "Texto" },
  { id: "page", label: "Página" },
  { id: "comfort", label: "Conforto" },
];
export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 26;

export function ReaderSettingsPanel({
  visible,
  panelMode,
  onClose,
  onReadInFocus,
  focusMinutesLeft = null,
  onEndFocus,
  focusSummaryEnabled = true,
  onFocusSummaryChange,
  onOpenDoNotDisturb,
  onOpenMilestones,
  onListen,
  onStopListening,
  listening = false,
  pdfMode,
  pdfSettings,
  onPdfModeChange,
  onPdfSettingsChange,
  pdfSettingsSaveError,
  onToggleFullscreen,
  pageNumber,
  totalPages,
  onGoToPage,
  chapterItems,
  chapterIndex,
  onSelectChapter,
  searchText,
  onSearchTextChange,
  onSearch,
  searchResult,
}: Props) {
  const [section, setSection] = useState<SectionId>("text");
  const [expanded, setExpanded] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const settings = useReaderSettings();
  const insets = useSafeAreaInsets();
  const [pageInput, setPageInput] = useState(String(pageNumber ?? 1));
  const resolve = (selected: PdfReaderTheme) => (settings.resolveTheme ? settings.resolveTheme(selected) : selected) as PdfReaderTheme;
  const palette = pdfSettings ? pdfReaderThemes[resolve(pdfSettings.theme)] : settings.palette;
  const updatePdfSettings = (patch: Partial<PdfReaderSettings>) => {
    if (pdfSettings) onPdfSettingsChange?.({ ...pdfSettings, ...patch });
  };
  const isOriginalPdf = !!pdfSettings && pdfMode === "original";
  const appearance = panelMode === "appearance";
  // Falha de gravação visível só nos ajustes (onde o leitor mexe); não fecha o painel nem altera o documento.
  const saveError = pdfSettings ? pdfSettingsSaveError : settings.saveError;
  const availableSections = isOriginalPdf ? sections.filter(item => item.id !== "text") : sections;
  const activeSection: SectionId = isOriginalPdf && section === "text" ? "page" : section;
  const followApp = !!settings.followAppTheme;
  const currentTheme = pdfSettings ? resolve(pdfSettings.theme) : settings.theme;
  const currentFont = pdfSettings ? pdfSettings.font : settings.font;
  const fontSize = pdfSettings ? pdfSettings.fontSize : settings.fontSize;
  const setFontSize = (value: number) => {
    const next = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(value)));
    if (pdfSettings) updatePdfSettings({ fontSize: next }); else settings.setFontSize(next);
  };

  useEffect(() => {
    if (visible) setPageInput(String(pageNumber ?? 1));
  }, [pageNumber, visible]);
  useEffect(() => { if (!visible) { setConfirmingReset(false); setExpanded(false); } }, [visible]);

  const openSection = (id: SectionId) => { setSection(id); setExpanded(true); setConfirmingReset(false); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const restoreDefaults = () => {
    // Só tipografia e página do modo atual; tema, brilho e posição de leitura não mudam.
    if (pdfSettings) {
      const { font, fontSize: size, lineHeight, paragraphSpacing, margin, maxWidth, alignment } = defaultPdfReaderSettings;
      updatePdfSettings({ font, fontSize: size, lineHeight, paragraphSpacing, margin, maxWidth, alignment });
    } else {
      settings.setFont("serif"); settings.setFontSize(16); settings.setLineHeight(DEFAULT_READER_LINE_HEIGHT);
      settings.setParagraphSpacing(DEFAULT_READER_PARAGRAPH_SPACING); settings.setMargin("medium"); settings.setMaxWidth(900); settings.setAlignment?.("left");
    }
    setConfirmingReset(false);
  };
  const title = panelMode === "contents" ? "Sumário" : panelMode === "search" ? "Buscar no livro" : "Ajustes de leitura";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable accessibilityLabel="Fechar preferências" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.panel, { backgroundColor: palette.panel, borderColor: palette.separator, maxHeight: !appearance || expanded ? "90%" : "62%" }]}>
          <View style={styles.panelHeader}>
            <View style={styles.headerRow}>
              <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{title}</Text>
              {appearance ? (
                <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Recolher ajustes" : "Expandir ajustes"} accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(!expanded)} android_ripple={{ color: palette.separator, borderless: true }} style={styles.iconButton}>
                  <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={22} color={palette.text} />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar ajustes de leitura" onPress={onClose} android_ripple={{ color: palette.separator, borderless: true }} style={styles.iconButton}>
                <Ionicons name="close" size={22} color={palette.text} />
              </Pressable>
            </View>
            {appearance && pdfSettings && onPdfModeChange ? (
              <View accessibilityLabel="Modo de leitura do PDF" style={styles.segmented}>
                <Segment label="PDF Original" selected={pdfMode === "original"} onPress={() => onPdfModeChange("original")} palette={palette} />
                <Segment label="Leitura Livre" selected={pdfMode === "reflow"} onPress={() => onPdfModeChange("reflow")} palette={palette} />
              </View>
            ) : null}
          </View>
          <ScrollView ref={scroll} style={styles.panelScroll} contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled"
            onLayout={event => readerUiDiagnostic("LAYOUT", "preferencesViewport", undefined, event.nativeEvent.layout)}
            onContentSizeChange={(width, height) => readerUiDiagnostic("LAYOUT", "preferencesContent", undefined, { x: 0, y: 0, width, height })}
            onScroll={event => readerUiDiagnostic("LAYOUT", "preferencesScroll", undefined, { x: event.nativeEvent.contentOffset.x, y: event.nativeEvent.contentOffset.y, width: event.nativeEvent.layoutMeasurement.width, height: event.nativeEvent.layoutMeasurement.height })}
          >
          {appearance && saveError ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.saveError, { borderColor: palette.accent }]}><Text style={{ color: palette.text }}>{saveError}</Text></View> : null}

          {panelMode === "contents" && chapterItems?.length && onSelectChapter ? (
            <View style={styles.chapterList}>
              {chapterItems.map(({ index, title: chapterTitle }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: index === chapterIndex }}
                  key={`${index}-${chapterTitle}`}
                  onPress={() => onSelectChapter(index)}
                  android_ripple={{ color: palette.separator }}
                  style={[styles.chapterItem, { borderColor: index === chapterIndex ? palette.accent : palette.separator }]}
                >
                  <Text style={{ color: palette.text, fontWeight: index === chapterIndex ? "600" : "400" }} numberOfLines={2}>{chapterTitle}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {panelMode === "search" ? (
            <>
              <View style={styles.row}>
                <TextInput
                  accessibilityLabel="Buscar no livro"
                  value={searchText ?? ""}
                  onChangeText={onSearchTextChange}
                  onSubmitEditing={onSearch}
                  returnKeyType="search"
                  style={[styles.searchInput, { color: palette.text, borderColor: palette.separator }]}
                />
                <ActionButton label="Buscar" onPress={() => onSearch?.()} palette={palette} />
              </View>
              {searchResult !== null && searchResult !== undefined ? (
                <Text style={[styles.hint, { color: palette.secondaryText }]}>{searchResult ? "Trecho encontrado" : "Nenhum resultado"}</Text>
              ) : null}
            </>
          ) : null}

          {appearance ? (
            <View style={styles.quick}>
              {isOriginalPdf ? (
                <Field label="Zoom" palette={palette}>
                  <View style={styles.stepper}>
                    <StepButton icon="remove" label="Diminuir zoom" disabled={pdfSettings.zoom <= 0.5} onPress={() => updatePdfSettings({ zoom: Math.max(0.5, pdfSettings.zoom - 0.25) })} palette={palette} />
                    <Text accessibilityLabel="Valor do zoom" style={[styles.stepValue, { color: palette.text }]}>{Math.round(pdfSettings.zoom * 100)}%</Text>
                    <StepButton icon="add" label="Aumentar zoom" disabled={pdfSettings.zoom >= 4} onPress={() => updatePdfSettings({ zoom: Math.min(4, pdfSettings.zoom + 0.25) })} palette={palette} />
                  </View>
                </Field>
              ) : (
                <>
                  <Field label="Tamanho da letra" palette={palette}>
                    <View style={styles.stepper}>
                      <StepButton text="A" textSize={15} label="Diminuir letra" disabled={fontSize <= FONT_SIZE_MIN} onPress={() => setFontSize(fontSize - 1)} palette={palette} />
                      <Slider
                        accessibilityLabel="Tamanho da fonte"
                        style={styles.slider}
                        minimumValue={FONT_SIZE_MIN}
                        maximumValue={FONT_SIZE_MAX}
                        step={1}
                        value={fontSize}
                        minimumTrackTintColor={palette.accent}
                        maximumTrackTintColor={palette.separator}
                        thumbTintColor={palette.accent}
                        onValueChange={setFontSize}
                      />
                      <StepButton text="A" textSize={23} label="Aumentar letra" disabled={fontSize >= FONT_SIZE_MAX} onPress={() => setFontSize(fontSize + 1)} palette={palette} />
                      <Text accessibilityLabel="Valor do tamanho da fonte" style={[styles.sizeValue, { color: palette.secondaryText }]}>{fontSize}</Text>
                    </View>
                  </Field>
                  <Field label={followApp ? "Tema · Automático (segue o app)" : "Tema"} palette={palette}>
                    <View accessibilityRole="radiogroup" style={styles.swatches}>
                      {themes.map(theme => {
                        const selected = currentTheme === theme.value;
                        const colors = (pdfSettings ? pdfReaderThemes[theme.value as PdfReaderTheme] : readerThemes[theme.value]) ?? palette;
                        return (
                          <Pressable key={theme.value} accessibilityRole="button" accessibilityLabel={`Tema ${theme.label}`} accessibilityState={{ selected }} aria-pressed={selected}
                            onPress={() => { if (pdfSettings) { settings.setFollowAppTheme?.(false); updatePdfSettings({ theme: theme.value as PdfReaderTheme }); } else settings.setTheme(theme.value); }} style={styles.swatch}>
                            <View style={[styles.swatchSample, { backgroundColor: colors.background, borderColor: selected ? palette.accent : palette.separator, borderWidth: selected ? 2 : 1 }]}>
                              {selected ? <Ionicons name="checkmark" size={18} color={colors.text} /> : <Text style={[styles.swatchLetters, { color: colors.text }]}>Aa</Text>}
                            </View>
                            <Text numberOfLines={1} style={[styles.swatchLabel, { color: selected ? palette.text : palette.secondaryText, fontWeight: selected ? "600" : "400" }]}>{theme.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable accessibilityRole="switch" accessibilityLabel="Tema automático: seguir claro e escuro do app" accessibilityState={{ checked: followApp }} aria-checked={followApp}
                      onPress={() => settings.setFollowAppTheme?.(!followApp)} android_ripple={{ color: palette.separator }}
                      style={[styles.autoChip, styles.autoTheme, { borderColor: followApp ? palette.accent : palette.separator, borderWidth: followApp ? 2 : 1 }]}>
                      <Ionicons name={followApp ? "checkmark" : "contrast-outline"} size={15} color={palette.text} />
                      <Text style={{ color: palette.text, fontSize: 13, fontWeight: followApp ? "600" : "400" }}>Automático: escuro quando o app estiver escuro</Text>
                    </Pressable>
                  </Field>
                </>
              )}
              <Field label={Platform.OS === "web" ? "Luminosidade da página" : "Brilho"} palette={palette}>
                <View style={styles.stepper}>
                  <Ionicons name="sunny-outline" size={18} color={palette.secondaryText} />
                  <Slider
                    accessibilityLabel={Platform.OS === "web" ? "Luminosidade da página" : "Brilho do leitor"}
                    style={[styles.slider, Platform.OS !== "web" && settings.useSystemBrightness ? styles.muted : null]}
                    minimumValue={20}
                    maximumValue={100}
                    step={1}
                    value={settings.brightness}
                    minimumTrackTintColor={palette.accent}
                    maximumTrackTintColor={palette.separator}
                    thumbTintColor={palette.accent}
                    onValueChange={value => { if (Platform.OS !== "web" && settings.useSystemBrightness) settings.setUseSystemBrightness(false); settings.setBrightness(value); }}
                  />
                  {Platform.OS === "web" ? <Text style={[styles.sizeValue, { color: palette.secondaryText }]}>{settings.brightness}%</Text> : (
                    <Pressable accessibilityRole="switch" accessibilityLabel="Usar brilho do aparelho" accessibilityState={{ checked: settings.useSystemBrightness }} aria-checked={settings.useSystemBrightness}
                      onPress={() => settings.setUseSystemBrightness(!settings.useSystemBrightness)} android_ripple={{ color: palette.separator }}
                      style={[styles.autoChip, { borderColor: settings.useSystemBrightness ? palette.accent : palette.separator, borderWidth: settings.useSystemBrightness ? 2 : 1 }]}>
                      {settings.useSystemBrightness ? <Ionicons name="checkmark" size={14} color={palette.text} /> : null}
                      <Text style={{ color: palette.text, fontSize: 13, fontWeight: settings.useSystemBrightness ? "600" : "400" }}>Automático</Text>
                    </Pressable>
                  )}
                </View>
              </Field>

              <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: palette.separator }]}>
                {availableSections.map(item => {
                  const selected = expanded && activeSection === item.id;
                  return (
                    <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Mais ajustes: ${item.label}`} accessibilityState={{ selected }} aria-pressed={selected} onPress={() => openSection(item.id)} android_ripple={{ color: palette.separator }} style={styles.tab}>
                      <Text style={[styles.tabText, { color: selected ? palette.text : palette.secondaryText, fontWeight: selected ? "700" : "500" }]}>{item.label}</Text>
                      <View style={[styles.tabBar, { backgroundColor: selected ? palette.accent : "transparent" }]} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {appearance && !isOriginalPdf ? (
            <View style={[styles.section, { display: expanded && activeSection === "text" ? "flex" : "none" }]}>
              <Field label="Fonte" palette={palette}>
                <View style={styles.fontList}>
                  {fonts.map(font => (
                    <Segment key={font.value} label={font.label} sample="Aa" sampleFont={fontFamilies[font.value]} selected={currentFont === font.value} palette={palette}
                      onPress={() => pdfSettings ? updatePdfSettings({ font: font.value }) : settings.setFont(font.value)} />
                  ))}
                </View>
              </Field>
              <Field label="Espaço entre linhas" palette={palette}>
                <SegmentedControl
                  options={spacingOptions(pdfSettings ? defaultPdfReaderSettings.lineHeight : DEFAULT_READER_LINE_HEIGHT, 0.25)}
                  selectedValue={pdfSettings ? pdfSettings.lineHeight : settings.lineHeight}
                  palette={palette}
                  onSelect={(value) => pdfSettings ? updatePdfSettings({ lineHeight: Number(value) }) : settings.setLineHeight(Number(value))}
                />
              </Field>
              <Field label="Espaço entre parágrafos" palette={palette}>
                <SegmentedControl
                  options={spacingOptions(pdfSettings ? defaultPdfReaderSettings.paragraphSpacing : DEFAULT_READER_PARAGRAPH_SPACING, 0.5)}
                  selectedValue={pdfSettings ? pdfSettings.paragraphSpacing : settings.paragraphSpacing}
                  palette={palette}
                  onSelect={(value) => pdfSettings ? updatePdfSettings({ paragraphSpacing: Number(value) }) : settings.setParagraphSpacing(Number(value))}
                />
              </Field>
              <Field label="Alinhamento" palette={palette}>
                <View style={styles.segmented}>
                  <Segment label="À esquerda" selected={(pdfSettings ? pdfSettings.alignment : settings.alignment) !== "justify"} onPress={() => pdfSettings ? updatePdfSettings({ alignment: "left" }) : settings.setAlignment?.("left")} palette={palette} />
                  <Segment label="Justificado" selected={(pdfSettings ? pdfSettings.alignment : settings.alignment) === "justify"} onPress={() => pdfSettings ? updatePdfSettings({ alignment: "justify" }) : settings.setAlignment?.("justify")} palette={palette} />
                </View>
              </Field>
              {confirmingReset ? (
                <View style={styles.row}>
                  <ActionButton label="Confirmar: voltar ao padrão" onPress={restoreDefaults} palette={palette} />
                  <ActionButton label="Cancelar" onPress={() => setConfirmingReset(false)} palette={palette} />
                </View>
              ) : <ActionButton label="Restaurar texto e página padrão" onPress={() => setConfirmingReset(true)} palette={palette} />}
            </View>
          ) : null}

          {appearance ? (
            <View style={[styles.section, { display: expanded && activeSection === "page" ? "flex" : "none" }]}>
              {!isOriginalPdf ? (
                <Field label="Textura do papel" palette={palette}>
                  <SegmentedControl
                    options={PAPER_TEXTURES.map((texture, index) => ({ label: texture.label, value: index }))}
                    selectedValue={Math.max(0, PAPER_TEXTURES.findIndex(texture => texture.value === (settings.paperTexture ?? "none")))}
                    palette={palette}
                    onSelect={(value) => settings.setPaperTexture?.(PAPER_TEXTURES[Number(value)]?.value ?? "none")}
                  />
                </Field>
              ) : null}
              {!isOriginalPdf ? (
                <Field label="Virar página" palette={palette}>
                  <SegmentedControl
                    options={PAGE_TURNS.map((turn, index) => ({ label: turn.label, value: index }))}
                    selectedValue={Math.max(0, PAGE_TURNS.findIndex(turn => turn.value === (settings.pageTurn ?? "slide")))}
                    palette={palette}
                    onSelect={(value) => settings.setPageTurn?.(PAGE_TURNS[Number(value)]?.value ?? "slide")}
                  />
                </Field>
              ) : null}
              {!isOriginalPdf ? (
                <Field label="Margens e largura" palette={palette}>
                  <SegmentedControl
                    options={[{ label: "Estreita", value: 0 }, { label: "Normal", value: 1 }, { label: "Larga", value: 2 }]}
                    selectedValue={layoutPresetIndex(pdfSettings ? pdfSettings.margin : settings.marginSize, pdfSettings ? pdfSettings.maxWidth : settings.maxWidth)}
                    palette={palette}
                    onSelect={(value) => {
                      const index = Number(value);
                      if (pdfSettings) {
                        const presets = [{ margin: 40, maxWidth: 560 }, { margin: 24, maxWidth: 760 }, { margin: 12, maxWidth: 1200 }];
                        updatePdfSettings(presets[index]);
                      } else {
                        const presets = [
                          { margin: "large" as const, maxWidth: 600 },
                          { margin: "medium" as const, maxWidth: 900 },
                          { margin: "small" as const, maxWidth: 1200 },
                        ];
                        settings.setMargin(presets[index].margin);
                        settings.setMaxWidth(presets[index].maxWidth);
                      }
                    }}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Ajuste" palette={palette}>
                    <View style={styles.segmented}>
                      <Segment label="À página" selected={pdfSettings.fitMode === "page"} onPress={() => updatePdfSettings({ fitMode: "page", zoom: 1 })} palette={palette} />
                      <Segment label="À largura" selected={pdfSettings.fitMode === "width"} onPress={() => updatePdfSettings({ fitMode: "width", zoom: 1 })} palette={palette} />
                    </View>
                  </Field>
                  <Field label="Páginas lado a lado" palette={palette}>
                    <View style={styles.segmented}>
                      <Segment label="Única" selected={pdfSettings.layout === "single"} onPress={() => updatePdfSettings({ layout: "single" })} palette={palette} />
                      <Segment label="Dupla" selected={pdfSettings.layout === "double"} onPress={() => updatePdfSettings({ layout: "double", rotation: 0 })} palette={palette} />
                    </View>
                  </Field>
                  <View style={styles.row}>
                    {pdfSettings.layout === "single" ? <ActionButton label={`Girar (${pdfSettings.rotation}°)`} onPress={() => updatePdfSettings({ rotation: (pdfSettings.rotation + 90) % 360 })} palette={palette} /> : null}
                    {onToggleFullscreen ? <ActionButton label="Tela cheia" onPress={onToggleFullscreen} palette={palette} /> : null}
                  </View>
                  {onGoToPage && totalPages ? (
                    <Field label={`Ir para a página (1–${totalPages})`} palette={palette}>
                      <View style={styles.row}>
                        <TextInput
                          accessibilityLabel="Número da página"
                          keyboardType="number-pad"
                          value={pageInput}
                          onChangeText={setPageInput}
                          onSubmitEditing={() => submitPage(pageInput, totalPages, onGoToPage)}
                          style={[styles.pageInput, { color: palette.text, borderColor: palette.separator }]}
                        />
                        <ActionButton label="Ir" onPress={() => submitPage(pageInput, totalPages, onGoToPage)} palette={palette} />
                      </View>
                    </Field>
                  ) : null}
                  <Text style={[styles.hint, { color: palette.secondaryText }]}>O PDF Original mantém a tipografia do arquivo. Para mudar letra e espaçamento, use Leitura Livre.</Text>
                </>
              )}
            </View>
          ) : null}

          {appearance ? (
            <View style={[styles.section, { display: expanded && activeSection === "comfort" ? "flex" : "none" }]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={{ color: palette.text }}>Ocultar porcentagem e páginas</Text>
                  <Text style={[styles.hint, { color: palette.secondaryText }]}>Toque no centro da página para mostrar ou esconder os controles.</Text>
                </View>
                <Switch accessibilityLabel="Ocultar porcentagem e contagem de páginas" value={settings.hideReadingCounts} onValueChange={settings.setHideReadingCounts} thumbColor={settings.hideReadingCounts ? palette.accent : palette.panel} trackColor={{ false: palette.separator, true: palette.accent }} />
              </View>
              {onReadInFocus ? <ActionButton label="Ler em foco" onPress={() => onReadInFocus()} palette={palette} /> : null}
              {onReadInFocus && focusMinutesLeft === null ? (
                <Field label="Ler em foco por" palette={palette}>
                  <View style={styles.segmented}>
                    {FOCUS_GOAL_MINUTES.map(minutes => (
                      <Segment key={minutes} label={`${minutes} min`} selected={false} palette={palette} onPress={() => onReadInFocus(minutes)} />
                    ))}
                  </View>
                </Field>
              ) : null}
              {onReadInFocus && focusMinutesLeft !== null && onEndFocus ? (
                <ActionButton label={settings.hideReadingCounts ? "Encerrar foco" : `Encerrar foco (faltam ${focusMinutesLeft} min)`} accessibilityLabel="Encerrar foco" onPress={onEndFocus} palette={palette} />
              ) : null}
              {onReadInFocus ? <Text style={[styles.hint, { color: palette.secondaryText }]}>Conta só tempo de leitura ativa: parado por mais de 3 minutos ou fora do app não conta. Fica guardado só neste aparelho.</Text> : null}
              {onFocusSummaryChange ? (
                <View style={styles.toggleRow}>
                  <View style={styles.toggleCopy}><Text style={{ color: palette.text }}>Mostrar resumo ao terminar o foco</Text></View>
                  <Switch accessibilityLabel="Mostrar resumo ao terminar o foco" value={focusSummaryEnabled} onValueChange={onFocusSummaryChange} thumbColor={focusSummaryEnabled ? palette.accent : palette.panel} trackColor={{ false: palette.separator, true: palette.accent }} />
                </View>
              ) : null}
              {onOpenDoNotDisturb ? <ActionButton label="Abrir Não perturbe do Android" onPress={onOpenDoNotDisturb} palette={palette} /> : null}
              {onOpenDoNotDisturb ? <Text style={[styles.hint, { color: palette.secondaryText }]}>Abre a tela do sistema; o Aldus não muda essa configuração.</Text> : null}
              {onOpenMilestones ? <ActionButton label="Marcos de leitura" onPress={onOpenMilestones} palette={palette} /> : null}
              {listening && onStopListening ? <ActionButton label="Parar leitura em voz alta" onPress={onStopListening} palette={palette} />
                : onListen ? <ActionButton label="Ouvir a partir desta página" onPress={onListen} palette={palette} /> : null}
              {onListen ? <Text style={[styles.hint, { color: palette.secondaryText }]}>Usa a voz do aparelho, sem internet. As páginas não viram sozinhas durante a leitura.</Text> : null}
              <MotionCuesControl color={palette.text} />
            </View>
          ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  saveError: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  // Fundo leve: o leitor precisa enxergar o texto mudando atrás da folha.
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 8, paddingBottom: 0 },
  panel: { width: "100%", maxWidth: 560, padding: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignSelf: "center" },
  panelHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  panelScroll: { flexShrink: 1 },
  panelContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  title: { flex: 1, fontSize: 17, fontWeight: "600" },
  quick: { gap: 14 },
  section: { gap: 16, paddingTop: 16 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "500" },
  hint: { fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepButton: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  stepValue: { minWidth: 64, textAlign: "center", fontSize: 15, fontWeight: "600" },
  sizeValue: { minWidth: 34, textAlign: "right", fontSize: 13 },
  slider: { flex: 1, minWidth: 0, height: 38 },
  muted: { opacity: 0.45 },
  swatches: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  swatch: { flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", gap: 5 },
  swatchSample: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  swatchLetters: { fontSize: 15, fontWeight: "600" },
  swatchLabel: { fontSize: 12, textAlign: "center" },
  autoChip: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 22 },
  autoTheme: { alignSelf: "flex-start", marginTop: 4 },
  tabs: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2 },
  tab: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "flex-end", gap: 8 },
  tabText: { fontSize: 14 },
  tabBar: { height: 3, width: "56%", borderRadius: 2 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleCopy: { flex: 1, gap: 3 },
  segmented: { flexDirection: "row", width: "100%", gap: 8 },
  segment: { flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, gap: 2 },
  segmentText: { fontSize: 13, textAlign: "center", flexShrink: 1 },
  segmentSample: { fontSize: 20 },
  // Fontes em linhas inteiras: "Alta legibilidade (Verdana)" não cabe em um terço da largura a 320 px.
  fontList: { width: "100%", gap: 8 },
  fontOption: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%", flexDirection: "row", justifyContent: "flex-start", gap: 12, paddingHorizontal: 14 },
  fontOptionText: { textAlign: "left" },
  action: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  pageInput: { minWidth: 88, height: 44, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10 },
  searchInput: { flex: 1, minWidth: 120, height: 44, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10 },
  chapterList: { gap: 8 },
  chapterItem: { minHeight: 44, justifyContent: "center", paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10 },
});

function submitPage(value: string, totalPages: number, onGoToPage: (pageNumber: number) => void): void {
  const page = Number(value);
  if (Number.isInteger(page) && page >= 1 && page <= totalPages) onGoToPage(page);
}

/**
 * BUG 15: a opção do meio é sempre o padrão do modo (EPUB 1,65 / PDF Reflow 1,6 de entrelinha; 1 de parágrafo), então o
 * padrão aparece marcado e tocar nele não muda o texto. Valores salvos fora da lista não são reescritos: nenhum item fica marcado.
 */
export function spacingOptions(defaultValue: number, step: number): Array<{ label: string; value: number }> {
  const round = (value: number) => Math.round(value * 100) / 100;
  return [{ label: "Compacto", value: round(defaultValue - step) }, { label: "Padrão", value: defaultValue }, { label: "Amplo", value: round(defaultValue + step) }];
}

function layoutPresetIndex(margin: number, maxWidth: number): number {
  if (margin >= 36 && maxWidth <= 700) return 0;
  if (margin <= 18 && maxWidth >= 1000) return 2;
  return 1;
}

/** Rótulo curto em frase (sem caixa alta) + o controle. */
function Field({ label, palette, children }: { label: string; palette: Palette; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.secondaryText }]}>{label}</Text>
      {children}
    </View>
  );
}

function SegmentedControl({ options, selectedValue, palette, onSelect }: {
  options: Array<{ label: string; value: number }>;
  selectedValue: number;
  palette: Palette;
  onSelect: (value: number) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(option => <Segment key={option.label} label={option.label} selected={Math.abs(option.value - selectedValue) < 0.001} onPress={() => onSelect(option.value)} palette={palette} />)}
    </View>
  );
}

/** Opção de um grupo. Seleção por contorno mais grosso, peso do texto e marca (não só cor), sem bloco sólido. */
function Segment({ label, selected, onPress, palette, sample, sampleFont }: { label: string; selected: boolean; onPress: () => void; palette: Palette; sample?: string; sampleFont?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} aria-pressed={selected} onPress={onPress} android_ripple={{ color: palette.separator }}
      style={[styles.segment, sample ? styles.fontOption : null, { borderColor: selected ? palette.accent : palette.separator, borderWidth: selected ? 2 : 1 }]}>
      {sample ? <Text style={[styles.segmentSample, { color: palette.text, fontFamily: sampleFont }]}>{sample}</Text> : null}
      <Text numberOfLines={2} style={[styles.segmentText, sample ? styles.fontOptionText : null, { color: selected ? palette.text : palette.secondaryText, fontWeight: selected ? "700" : "400" }]}>{selected && !sample ? "✓ " : ""}{label}</Text>
    </Pressable>
  );
}

function StepButton({ label, onPress, palette, icon, text, textSize, disabled }: { label: string; onPress: () => void; palette: Palette; icon?: "add" | "remove"; text?: string; textSize?: number; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} android_ripple={{ color: palette.separator }}
      style={[styles.stepButton, { borderColor: palette.separator, opacity: disabled ? 0.4 : 1 }]}>
      {icon ? <Ionicons name={icon} size={20} color={palette.text} /> : <Text style={{ color: palette.text, fontSize: textSize, fontWeight: "600" }}>{text}</Text>}
    </Pressable>
  );
}

function ActionButton({ label, onPress, palette, accessibilityLabel }: { label: string; onPress: () => void; palette: Palette; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} android_ripple={{ color: palette.separator }} style={[styles.action, { borderColor: palette.separator }]}>
      <Text style={{ color: palette.text, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}
