import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, Chip, EmptyState, Screen, ScreenHeader, SearchField } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { appDependencies, libraryOrganization } from "@/src/presentation/services/dependencies";
import { catalog } from "@/src/data/catalog/catalogDependencies";
import { CatalogUnavailableError } from "@/src/data/catalog/catalogSources";
import { ALDUS_CATEGORIES, CatalogBook } from "@/src/domain/catalog/catalogBook";
import { createRecordBook, libraryMatchesForCatalog, RECORD_FORMAT_LABELS, RECORD_START_LABELS, recordBookOrganization, RecordBookFormat, RecordBookStart } from "@/src/domain/catalog/recordBook";
import { newLibraryId } from "@/src/domain/entities/libraryId";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookCover } from "@/src/presentation/components/BookCover";

/**
 * Catálogo de livros só com metadados (fase 2, 18/11/2026). Busca por título, autor ou ISBN no Open Library (só o texto buscado sai
 * do aparelho); a ficha mostra o que a fonte informa e permite guardar o livro sem arquivo: Quero ler, Estou lendo ou Já li.
 * Nunca há conteúdo nem link de download.
 */
export function CatalogScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogBook[] | null>(null);
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CatalogBook | null>(null);
  const [library, setLibrary] = useState<LibraryBook[]>([]);
  const request = useRef<AbortController | null>(null);

  const loadLibrary = useCallback(() => { appDependencies.bookRepository.listActive().then(setLibrary).catch(() => setLibrary([])); }, []);
  useEffect(() => { loadLibrary(); return () => request.current?.abort(); }, [loadLibrary]);

  const search = () => {
    const text = query.trim();
    if (text.length < 2 || loading) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null);
    catalog.search(text, controller.signal)
      .then(found => { if (request.current === controller) setResults(found); })
      .catch(failure => { if (request.current === controller && !controller.signal.aborted) setError(failure instanceof CatalogUnavailableError ? failure.message : "Não foi possível buscar agora. Tente de novo."); })
      .finally(() => { if (request.current === controller) { request.current = null; setLoading(false); } });
  };

  return (
    <Screen header={<ScreenHeader title="Buscar livros" subtitle="Qualquer livro, só as informações. Guarde na sua biblioteca mesmo sem o arquivo." back />}>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}><SearchField value={query} onChangeText={setQuery} placeholder="Título, autor ou ISBN" label="Buscar no catálogo" onSubmit={search} /></View>
        <Button label="Buscar" variant="primary" onPress={search} disabled={query.trim().length < 2 || loading} loading={loading} />
      </View>
      <AppText variant="caption" tone="secondary">Informações do Open Library. Só o texto buscado sai do aparelho.</AppText>
      {error ? <EmptyState icon="cloud-offline-outline" title="Catálogo indisponível" description={error}><Button label="Tentar de novo" onPress={search} /></EmptyState> : null}
      {!error && results && results.length === 0 ? <EmptyState icon="search-outline" title="Nenhum livro encontrado" description="Tente outro título, o sobrenome do autor ou o ISBN. Edições brasileiras recentes podem faltar nesta base." /> : null}
      {!error && !results && !loading ? <EmptyState icon="library-outline" title="Busque qualquer livro" description="Livro físico, de outra loja ou audiolivro: guarde na sua estante, marque Quero ler e acompanhe." /> : null}
      <View style={styles.list}>
        {(results ?? []).map(book => <CatalogRow key={book.id} book={book} inLibrary={libraryMatchesForCatalog(library, book.id).length > 0} onPress={() => setSelected(book)} />)}
      </View>
      {selected ? <CatalogBookSheet book={selected} inLibrary={libraryMatchesForCatalog(library, selected.id)} onClose={() => setSelected(null)} onAdded={loadLibrary} /> : null}
    </Screen>
  );
}

function CatalogRow({ book, inLibrary, onPress }: { book: CatalogBook; inLibrary: boolean; onPress: () => void }) {
  const { palette } = useAppTheme();
  const meta = [book.authors.join(", ") || "Autor não informado", book.firstPublishYear ? String(book.firstPublishYear) : null].filter(Boolean).join(" · ");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${book.title}, ${meta}${inLibrary ? ", na sua biblioteca" : ""}`} onPress={onPress} android_ripple={{ color: palette.separator }}
      style={[styles.row, { borderBottomColor: palette.separator }]}>
      <View style={styles.thumb}><BookCover identity={book.id} title={book.title} author={book.authors[0]} format="livro" source={book.coverUrl ? { uri: book.coverUrl } : null} compact /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText variant="label" numberOfLines={2}>{book.title}</AppText>
        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>{meta}</AppText>
        {book.categories.length ? <AppText variant="caption" tone="accent" numberOfLines={1}>{book.categories.map(c => ALDUS_CATEGORIES[c]).join(" · ")}</AppText> : null}
        {inLibrary ? <AppText variant="caption" tone="success">Na sua biblioteca</AppText> : null}
      </View>
    </Pressable>
  );
}

function CatalogBookSheet({ book, inLibrary, onClose, onAdded }: { book: CatalogBook; inLibrary: LibraryBook[]; onClose: () => void; onAdded: () => void }) {
  const { palette } = useAppTheme();
  const [format, setFormat] = useState<RecordBookFormat>("physical");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null), [added, setAdded] = useState(inLibrary.length > 0);
  const add = async (start: RecordBookStart) => {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      const now = Date.now(), record = createRecordBook({ catalog: book, format, id: newLibraryId(), now });
      await appDependencies.bookRepository.save(record);
      await libraryOrganization.save(recordBookOrganization(record.id, start, now));
      setAdded(true); onAdded();
      setMessage(`Guardado na sua biblioteca como “${RECORD_START_LABELS[start]}”. Por enquanto, livros sem arquivo ficam só neste aparelho.`);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Não foi possível guardar o livro."); }
    finally { setBusy(false); }
  };
  const facts = [
    book.firstPublishYear ? `Primeira publicação: ${book.firstPublishYear}` : null,
    book.pages ? `${book.pages} páginas (média das edições)` : null,
    book.isbns[0] ? `ISBN ${book.isbns[0]}` : null,
  ].filter(Boolean) as string[];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.panel, borderColor: palette.border }]}>
          <View style={[styles.grab, { backgroundColor: palette.separator }]} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.head}>
              <View style={styles.cover}><BookCover identity={book.id} title={book.title} author={book.authors[0]} format="livro" source={book.coverUrl ? { uri: book.coverUrl } : null} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <AppText variant="title" accessibilityRole="header">{book.title}</AppText>
                {book.subtitle ? <AppText variant="bodySmall" tone="secondary">{book.subtitle}</AppText> : null}
                <AppText variant="body">{book.authors.join(", ") || "Autor não informado"}</AppText>
              </View>
            </View>
            {/* The decision comes first, so it is visible without scrolling at 320 px; details follow. */}
            {added ? <View style={[styles.notice, { backgroundColor: palette.surfaceSecondary }]}>
              <AppText variant="label">Na sua biblioteca</AppText>
              <AppText variant="bodySmall" tone="secondary">Mude o estado ou marque “Quero ler” pelo menu do livro na Biblioteca. Se tiver o arquivo, importe-o pela Biblioteca.</AppText>
            </View> : <>
              <AppText variant="label">Como você tem este livro?</AppText>
              <View style={styles.chips}>{(Object.keys(RECORD_FORMAT_LABELS) as RecordBookFormat[]).map(value => <Chip key={value} label={RECORD_FORMAT_LABELS[value]} selected={format === value} onPress={() => setFormat(value)} />)}</View>
              <Button label={RECORD_START_LABELS.want} variant="primary" icon="bookmark-outline" block onPress={() => void add("want")} disabled={busy} />
              <View style={styles.actions}>{(["reading", "completed"] as RecordBookStart[]).map(value => <View key={value} style={{ flex: 1 }}><Button label={RECORD_START_LABELS[value]} variant="secondary" block onPress={() => void add(value)} disabled={busy} /></View>)}</View>
            </>}
            {message ? <AppText variant="bodySmall" accessibilityRole="alert">{message}</AppText> : null}
            {facts.length ? <View style={{ gap: 2 }}>{facts.map(fact => <AppText key={fact} variant="bodySmall" tone="secondary">{fact}</AppText>)}</View> : null}
            {book.categories.length ? <View style={styles.chips}>{book.categories.map(c => <View key={c} style={[styles.tag, { borderColor: palette.border }]}><AppText variant="caption">{ALDUS_CATEGORIES[c]}</AppText></View>)}</View> : null}
            {book.subjects.length ? <AppText variant="caption" tone="secondary" numberOfLines={3}>{`Assuntos: ${book.subjects.slice(0, 8).join(" · ")}`}</AppText> : null}
            {book.sourceUrl ? <Pressable accessibilityRole="link" accessibilityLabel="Ver a fonte destas informações no Open Library" onPress={() => void Linking.openURL(book.sourceUrl!)} style={styles.credit}>
              <AppText variant="caption" tone="accent">Informações: Open Library</AppText>
            </Pressable> : null}
            <Button label="Fechar" variant="ghost" block onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  list: { marginTop: 4 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 76 },
  thumb: { width: 48, height: 72, borderRadius: 3, overflow: "hidden" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "92%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, width: "100%", maxWidth: 620, alignSelf: "center" },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8 },
  sheetContent: { padding: 20, gap: 14 },
  head: { flexDirection: "row", gap: 16 },
  cover: { width: 80, height: 120, borderRadius: 4, overflow: "hidden" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  notice: { borderRadius: 12, padding: 12, gap: 4 },
  actions: { flexDirection: "row", gap: 8 },
  credit: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
