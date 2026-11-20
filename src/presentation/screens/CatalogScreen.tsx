import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, Chip, EmptyState, Screen, ScreenHeader, SearchField } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { appDependencies, libraryOrganization } from "@/src/presentation/services/dependencies";
import { catalog, catalogSourcesLabel } from "@/src/data/catalog/catalogDependencies";
import { CatalogUnavailableError } from "@/src/data/catalog/catalogSources";
import { ALDUS_CATEGORIES, AldusCategory, CatalogBook } from "@/src/domain/catalog/catalogBook";
import { CATEGORY_QUERIES, INITIAL_SHELVES, libraryAffinity, pickSurprise } from "@/src/domain/catalog/catalogShelves";
import { OrganizationRecords } from "@/src/domain/types/libraryOrganization";
import { CatalogShelves } from "@/src/presentation/components/catalog/CatalogShelves";
import { createRecordBook, libraryMatchesForCatalog, RECORD_FORMAT_LABELS, RECORD_START_LABELS, recordBookOrganization, RecordBookFormat, RecordBookStart } from "@/src/domain/catalog/recordBook";
import { newLibraryId } from "@/src/domain/entities/libraryId";
import { isRecordBook, LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookCover } from "@/src/presentation/components/BookCover";
import { router, useLocalSearchParams } from "expo-router";
import { linkFileToCatalog } from "@/src/data/catalog/catalogLinking";
import { YourSources } from "@/src/presentation/components/catalog/YourSources";

/**
 * Catálogo de livros só com metadados (fase 2, 18/11/2026). Busca por título, autor ou ISBN no Open Library (só o texto buscado sai
 * do aparelho); a ficha mostra o que a fonte informa e permite guardar o livro sem arquivo: Quero ler, Estou lendo ou Já li.
 * Nunca há conteúdo nem link de download.
 */
/** `tab`: a aba Descobrir (19/11/2026, dono: "troca essa aba descobrir pelo catalogo estilo netflix"), sem voltar e com Suas fontes no fim. */
export function CatalogScreen({ tab = false }: { tab?: boolean } = {}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogBook[] | null>(null);
  const [heading, setHeading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CatalogBook | null>(null);
  const [library, setLibrary] = useState<LibraryBook[]>([]);
  const [organization, setOrganization] = useState<OrganizationRecords>({});
  const request = useRef<AbortController | null>(null), last = useRef<{ text: string; heading: string | null } | null>(null);
  // "Ligar ao catálogo" (A5): aberta pelo menu de um livro com arquivo, a busca já vem com o título e a ficha liga em vez de guardar.
  const params = useLocalSearchParams<{ link?: string; q?: string }>();
  const linkId = typeof params.link === "string" && params.link ? params.link : null;
  const [linkTarget, setLinkTarget] = useState<LibraryBook | null>(null), [linkedTo, setLinkedTo] = useState<string | null>(null);
  const started = useRef(false);
  const recentSurprises = useRef<string[]>([]);
  const [surprising, setSurprising] = useState(false), [surpriseError, setSurpriseError] = useState<string | null>(null);

  const loadLibrary = useCallback(() => {
    appDependencies.bookRepository.listActive().then(setLibrary).catch(() => setLibrary([]));
    libraryOrganization.list().then(setOrganization).catch(() => setOrganization({}));
  }, []);
  useEffect(() => { loadLibrary(); return () => request.current?.abort(); }, [loadLibrary]);

  const run = (text: string, label: string | null) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller; last.current = { text, heading: label };
    setLoading(true); setError(null); setHeading(label);
    catalog.search(text, controller.signal)
      .then(found => { if (request.current === controller) setResults(found); })
      .catch(failure => { if (request.current === controller && !controller.signal.aborted) setError(failure instanceof CatalogUnavailableError ? failure.message : "Não foi possível buscar agora. Tente de novo."); })
      .finally(() => { if (request.current === controller) { request.current = null; setLoading(false); } });
  };
  const search = () => {
    const text = query.trim();
    const shown = last.current?.text === text && last.current.heading === null && results !== null && !error;
    if (text.length >= 2 && !loading && !shown) run(text, null);
  };
  // Busca enquanto digita (19/11, como no Papel Amassado): espera a pessoa parar de digitar; cada busca nova cancela a anterior.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3 || (last.current?.text === text && last.current.heading === null)) return;
    const timer = setTimeout(() => { if (last.current?.text !== text || last.current.heading !== null) run(text, null); }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  const browse = (category: AldusCategory) => { setQuery(""); run(CATEGORY_QUERIES[category], ALDUS_CATEGORIES[category]); };
  const backToShelves = () => { request.current?.abort(); request.current = null; setLoading(false); setResults(null); setError(null); setHeading(null); };
  const browsing = results !== null || loading || error !== null;
  const surprise = async () => {
    if (surprising) return;
    setSurprising(true); setSurpriseError(null);
    try {
      const owned = new Set(library.map(book => book.catalogId).filter((id): id is string => !!id));
      const affinity = libraryAffinity(library, organization), recent = new Set(recentSurprises.current);
      let book = pickSurprise(await catalog.cachedBooks(), affinity, owned, recent);
      // Nada baixado ainda neste aparelho: carrega uma das fileiras iniciais e sorteia dela.
      if (!book) book = pickSurprise(await catalog.search(CATEGORY_QUERIES[INITIAL_SHELVES[Math.floor(Math.random() * INITIAL_SHELVES.length)]]), affinity, owned, recent);
      if (!book) { setSurpriseError("Não há livros para sortear agora. Tente de novo em instantes."); return; }
      recentSurprises.current = [book.id, ...recentSurprises.current].slice(0, 20);
      setSelected(book);
    } catch (failure) {
      setSurpriseError(failure instanceof CatalogUnavailableError ? failure.message : "Não foi possível sortear agora. Tente de novo.");
    } finally { setSurprising(false); }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (linkId) appDependencies.bookRepository.findById(linkId).then(book => setLinkTarget(book && !book.isDeleted ? book : null)).catch(() => setLinkTarget(null));
    // Also opened from the Library search with no match on the shelf: the same words are searched here at once.
    const text = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
    if (text.length >= 2) { setQuery(text); run(text, null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  return (
    <Screen inTabs={tab} header={tab
      ? <ScreenHeader title="Descobrir" subtitle="Qualquer livro, só as informações. Guarde na sua biblioteca mesmo sem o arquivo." large />
      : <ScreenHeader title="Buscar livros" subtitle="Qualquer livro, só as informações. Guarde na sua biblioteca mesmo sem o arquivo." back />}>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}><SearchField value={query} onChangeText={setQuery} placeholder="Título, autor ou ISBN" label="Buscar no catálogo" onSubmit={search} /></View>
        <Button label="Buscar" variant="primary" onPress={search} disabled={query.trim().length < 2 || loading} loading={loading} />
      </View>
      <AppText variant="caption" tone="secondary">{`Informações do ${catalogSourcesLabel ?? "Open Library"}. Só o texto buscado ou a categoria escolhida sai do aparelho.`}</AppText>
      {!browsing ? <View style={styles.surprise}>
        <Button label="Sortear um livro" icon="shuffle" onPress={() => void surprise()} loading={surprising} disabled={surprising}
          accessibilityHint="Abre a ficha de um livro sorteado entre as prateleiras e o Para você" />
        {surpriseError ? <AppText variant="bodySmall" tone="secondary" accessibilityRole="alert">{surpriseError}</AppText> : null}
      </View> : null}
      {linkTarget ? <View style={[styles.notice, { backgroundColor: "transparent", borderWidth: 1, borderColor: "#8884" }]}>
        <AppText variant="label">{linkedTo ? `“${linkTarget.title}” ligado a “${linkedTo}”.` : `Escolha o livro do catálogo que corresponde a “${linkTarget.title}”.`}</AppText>
        {linkedTo ? <Button label="Voltar" variant="ghost" onPress={() => router.back()} /> : <AppText variant="bodySmall" tone="secondary">O arquivo não muda: o Aldus só passa a usar as informações e as categorias do catálogo.</AppText>}
      </View> : null}
      {browsing ? <View style={styles.resultHead}>
        <AppText variant="label" accessibilityRole="header" style={{ flex: 1 }}>{heading ? `Categoria: ${heading}` : "Resultados da busca"}</AppText>
        <Button label="Voltar à vitrine" variant="ghost" onPress={backToShelves} />
      </View> : null}
      {error ? <EmptyState icon="cloud-offline-outline" title="Catálogo indisponível" description={error}><Button label="Tentar de novo" onPress={() => last.current && run(last.current.text, last.current.heading)} /></EmptyState> : null}
      {!error && results && results.length === 0 ? <EmptyState icon="search-outline" title="Nenhum livro encontrado" description="Tente outro título, o sobrenome do autor ou o ISBN. Edições brasileiras recentes podem faltar nesta base." /> : null}
      {/* 19/11 (dono: "ficou muito escondido o drive e só abre depois do catálogo carregado"): Suas fontes antes das fileiras. */}
      {tab && !browsing ? <YourSources /> : null}
      {!browsing ? <CatalogShelves library={library} organization={organization} onOpen={setSelected} onBrowse={browse} /> : null}
      <View style={styles.list}>
        {(results ?? []).map(book => <CatalogRow key={book.id} book={book} inLibrary={libraryMatchesForCatalog(library, book.id).length > 0} onPress={() => setSelected(book)} />)}
      </View>
      {selected ? <CatalogBookSheet book={selected} inLibrary={libraryMatchesForCatalog(library, selected.id)} onClose={() => setSelected(null)} onAdded={loadLibrary}
        linkTarget={linkedTo ? null : linkTarget} onLinked={title => { setLinkedTo(title); setSelected(null); loadLibrary(); }} /> : null}
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

function CatalogBookSheet({ book, inLibrary, onClose, onAdded, linkTarget, onLinked }: { book: CatalogBook; inLibrary: LibraryBook[]; onClose: () => void; onAdded: () => void; linkTarget: LibraryBook | null; onLinked: (title: string) => void }) {
  const { palette } = useAppTheme();
  const [format, setFormat] = useState<RecordBookFormat>("physical");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null), [added, setAdded] = useState(inLibrary.length > 0);
  const link = async () => {
    if (busy || !linkTarget) return;
    setBusy(true); setMessage(null);
    try { await linkFileToCatalog(appDependencies.bookRepository, linkTarget.id, book); onLinked(book.title); }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : "Não foi possível ligar agora."); }
    finally { setBusy(false); }
  };
  const add = async (start: RecordBookStart) => {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      const now = Date.now(), record = createRecordBook({ catalog: book, format, id: newLibraryId(), now });
      await appDependencies.bookRepository.save(record);
      await libraryOrganization.save(recordBookOrganization(record.id, start, now));
      setAdded(true); onAdded();
      setMessage(`Guardado na sua biblioteca como “${RECORD_START_LABELS[start]}”. Ele aparece nos seus outros aparelhos quando a biblioteca sincronizar.`);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Não foi possível guardar o livro."); }
    finally { setBusy(false); }
  };
  const google = book.source === "googlebooks", sourceName = google ? "Google Books" : "Open Library";
  // Com o arquivo na biblioteca, a ficha leva direto à leitura.
  const readable = inLibrary.find(item => !isRecordBook(item) && !item.isDeleted) ?? null;
  const facts = [
    book.firstPublishYear ? `Primeira publicação: ${book.firstPublishYear}` : book.editionYear ? `Edição de ${book.editionYear}` : null,
    book.pages ? (google ? `${book.pages} páginas` : `${book.pages} páginas (média das edições)`) : null,
    book.isbns[0] ? `ISBN ${book.isbns[0]}` : null,
  ].filter(Boolean) as string[];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.panel, borderColor: palette.border }]}>
          <View style={[styles.grab, { backgroundColor: palette.separator }]} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {/* Capa ampliada e desfocada ao fundo do topo da ficha (19/11, como no Papel Amassado); decorativa, fora da leitura de tela. */}
            {book.coverUrl ? <Image source={{ uri: book.coverUrl }} blurRadius={24} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.coverBackdrop} /> : null}
            <View style={styles.head}>
              <View style={styles.cover}><BookCover identity={book.id} title={book.title} author={book.authors[0]} format="livro" source={book.coverUrl ? { uri: book.coverUrl } : null} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <AppText variant="title" accessibilityRole="header">{book.title}</AppText>
                {book.subtitle ? <AppText variant="bodySmall" tone="secondary">{book.subtitle}</AppText> : null}
                <AppText variant="body">{book.authors.join(", ") || "Autor não informado"}</AppText>
              </View>
            </View>
            {/* The decision comes first, so it is visible without scrolling at 320 px; details follow. */}
            {readable && !linkTarget ? <Button label="Ler livro" variant="primary" icon="book-outline" block onPress={() => { onClose(); router.push({ pathname: "/reader/[bookId]", params: { bookId: readable.id } } as never); }} /> : null}
            {linkTarget ? <Button label={`Ligar “${linkTarget.title}” a este livro`} variant="primary" block onPress={() => void link()} disabled={busy} loading={busy} />
            : added ? <View style={[styles.notice, { backgroundColor: palette.surfaceSecondary }]}>
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
            {/* Os assuntos vêm em inglês das fontes; com categorias do Aldus (em português) já na ficha, eles não aparecem (19/11). */}
            {book.subjects.length && !book.categories.length ? <AppText variant="caption" tone="secondary" numberOfLines={3}>{`Assuntos: ${book.subjects.slice(0, 8).join(" · ")}`}</AppText> : null}
            {book.description ? <View style={{ gap: 4 }}>
              <AppText variant="label" accessibilityRole="header">Sinopse</AppText>
              <AppText variant="bodySmall" tone="secondary">{book.description}</AppText>
            </View> : null}
            {book.sourceUrl ? <Pressable accessibilityRole="link" accessibilityLabel={`Ver a fonte destas informações no ${sourceName}`} onPress={() => void Linking.openURL(book.sourceUrl!)} style={styles.credit}>
              <AppText variant="caption" tone="accent">{`Informações: ${sourceName}`}</AppText>
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
  surprise: { alignItems: "flex-start", gap: 6 },
  list: { marginTop: 4 },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 76 },
  thumb: { width: 48, height: 72, borderRadius: 3, overflow: "hidden" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "92%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, width: "100%", maxWidth: 620, alignSelf: "center" },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8 },
  sheetContent: { padding: 20, gap: 14 },
  head: { flexDirection: "row", gap: 16 },
  coverBackdrop: { position: "absolute", top: 0, left: 0, right: 0, height: 170, opacity: 0.28 },
  cover: { width: 80, height: 120, borderRadius: 4, overflow: "hidden" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  notice: { borderRadius: 12, padding: 12, gap: 4 },
  actions: { flexDirection: "row", gap: 8 },
  credit: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
