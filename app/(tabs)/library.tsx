import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { useLibrary } from "@/src/presentation/hooks/useLibrary";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { libraryOrganization } from "@/src/presentation/services/dependencies";
import { BookOrganizationModal, readingStatusLabels } from "@/src/presentation/components/BookOrganizationModal";
import { BookOrganization, inferredReadingStatus, normalizeLibraryText, OrganizationRecords } from "@/src/domain/types/libraryOrganization";
import { BookCard as SharedBookCard } from "@/src/presentation/components/BookCard";
import { Book } from "@/src/constants/mockBooks";
import { catalogBookFor } from "@/src/presentation/services/bookDisplay";
import { isStalled, recentReads } from "@/src/domain/library/readingShelves";
import { FirstStepsCard } from "@/src/presentation/components/FirstStepsCard";
import { markEpubLibraryReady, startEpubOpenTrace } from "@/src/utils/epubOpenMetrics";
import { useBookImport } from "@/src/presentation/hooks/useBookImport";
import { BookImportModal } from "@/src/presentation/components/BookImportModal";
import { BookCloudControls } from '@/src/presentation/components/LibrarySyncControls';
import { libraryAccountScope } from '@/src/data/library/LibraryAccountScope';
import { LibraryBulkModal } from '@/src/presentation/components/LibraryBulkModal';
import { ActionMenu, ActionMenuItem, AppText, Button, Chip, ChipRow, EmptyState, IconButton, layout as uiLayout, ListGroup, ListRow, radius, ScreenHeader, SearchField, space } from '@/src/ui';

type BookFilter = "all" | "reading" | "completed" | "unread" | "interrupted" | "favorites" | "stalled";
type BookSort = "recent" | "title" | "author" | "progress" | "series";
type OpenMenu = "add" | "more" | "format" | "sort" | null;

const filters: { value: BookFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "reading", label: "Lendo" },
  { value: "completed", label: "Concluídos" },
  { value: "unread", label: "Não lidos" },
  { value: "interrupted", label: "Interrompidos" },
  { value: "favorites", label: "Favoritos" },
];
// Coleção automática: só aparece quando há pelo menos um livro nela.
const stalledFilter: { value: BookFilter; label: string } = { value: "stalled", label: "Parados há 30 dias" };

// `short` cabe numa linha no celular; `label` completo continua no menu e no nome acessível.
const sortShortLabels: Record<BookSort, string> = { recent: "Recentes", title: "Título", author: "Autor", progress: "Progresso", series: "Série" };
const sorts: { value: BookSort; label: string }[] = [
  { value: "recent", label: "Adicionados recentemente" },
  { value: "title", label: "Título A–Z" },
  { value: "author", label: "Autor" },
  { value: "progress", label: "Progresso" },
  { value: "series", label: "Série e volume" },
];


export default function Library() {
  const generation = useSyncExternalStore(listener => libraryAccountScope.subscribe(listener), () => libraryAccountScope.generation, () => 0);
  return <LibraryContent key={generation} />;
}

function LibraryContent() {
  const insets = useSafeAreaInsets();
  const { books, status, error, reload } = useLibrary();
  const { palette, resolvedTheme, setMode } = useAppTheme();
  const bookImport = useBookImport(reload, bookId => router.push({ pathname: "/reader/[bookId]", params: { bookId } }));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BookFilter>("all");
  const [sort, setSort] = useState<BookSort>("recent");
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [organization, setOrganization] = useState<OrganizationRecords>({});
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState<LibraryBook | null>(null);
  const [collection, setCollection] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const [manageCollections, setManageCollections] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(360);
  const [format, setFormat] = useState<'all' | 'epub' | 'pdf'>('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const requests = useRef(0);
  const { width: windowWidth } = useWindowDimensions();
  const gutter = uiLayout.gutter(windowWidth);
  const columns = layout === 'list' ? 1 : Math.max(1, Math.min(6, Math.floor((layoutWidth - gutter * 2 + space.md) / 170)));
  const cellWidth = (layoutWidth - gutter * 2 - (columns - 1) * space.md) / columns;
  const loadOrganization = useCallback(async () => {
    const request = ++requests.current, scope = libraryAccountScope.capture();
    try {
      const records = await libraryOrganization.list(); scope.check();
      if (request !== requests.current) return;
      setOrganization(records); setOrganizationError(null);
    } catch (failure) {
      if (request !== requests.current) return;
      try { scope.check(); } catch { return; }
      setOrganizationError(failure instanceof Error ? failure.message : "Não foi possível carregar a organização.");
      throw failure;
    }
  }, []);
  const refreshOrganization = async () => {
    await loadOrganization(); await reload();
  };
  useEffect(() => { void loadOrganization().catch(() => undefined); return () => { requests.current++; }; }, [books, loadOrganization]);
  const collections = useMemo(() => [...new Set(books.flatMap(book => organization[book.id]?.collections ?? []))].sort((a, b) => a.localeCompare(b, "pt-BR")), [books, organization]);
  useEffect(() => { if (collection && !collections.includes(collection)) setCollection(""); }, [collection, collections]);
  // Callbacks estáveis: a célula memoizada (LibraryBookCell) só redesenha quando os próprios dados mudam (onda 2, P1).
  const toggleSelection = useCallback((id: string) => setSelection(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const openBook = useCallback((item: LibraryBook) => {
    if (item.mimeType === "application/epub+zip" && item.filePath.startsWith("bundled-epub://")) {
      startEpubOpenTrace(item.id, { fileName: item.fileName, source: "bundled-epub" });
    }
    router.push({ pathname: "/reader/[bookId]", params: { bookId: item.id } });
  }, []);
  const organizeBook = useCallback((item: LibraryBook, card: Book) => setOrganizing({ ...item, title: card.title, author: card.author }), []);
  const organizationDisabled = Boolean(organizationError);
  const selectedIds = useMemo(() => books.filter(book => selection.has(book.id)).map(book => book.id), [books, selection]);

  useEffect(() => {
    if (status === "success") markEpubLibraryReady();
  }, [status]);

  const renderBook = useCallback(({ item }: { item: LibraryBook }) => (
    <LibraryBookCell item={item} record={organization[item.id]} selecting={selecting} selected={selection.has(item.id)} layout={layout} cellWidth={cellWidth}
      palette={palette} themeMode={resolvedTheme} organizationDisabled={organizationDisabled} onOpen={openBook} onToggle={toggleSelection} onOrganize={organizeBook} />
  ), [organization, selecting, selection, layout, cellWidth, palette, resolvedTheme, organizationDisabled, openBook, toggleSelection, organizeBook]);

  const visibleBooks = useMemo(() => {
    const normalizedQuery = normalizeLibraryText(query);
    const filtered = books.filter((book) => {
      const record = organization[book.id];
      const readingStatus = inferredReadingStatus(book, record);
      const matchesQuery =
        !normalizedQuery ||
        normalizeLibraryText(`${book.title} ${book.author} ${record?.series ?? ""} ${record?.collections.join(" ") ?? ""} ${record?.tags.join(" ") ?? ""}`).includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "favorites" ? record?.favorite : filter === "stalled" ? isStalled(book, record) : filter === readingStatus);
      const matchesFormat = format === 'all' || book.mimeType === (format === 'pdf' ? 'application/pdf' : 'application/epub+zip');
      return matchesQuery && matchesFilter && matchesFormat && (!collection || record?.collections.includes(collection));
    });

    return filtered.sort((first, second) => {
      if (sort === "title")
        return first.title.localeCompare(second.title, "pt-BR", {
          sensitivity: "base",
        });
      if (sort === "author")
        return first.author.localeCompare(second.author, "pt-BR", {
          sensitivity: "base",
        });
      if (sort === "progress") return second.progress - first.progress;
      if (sort === "series") return (organization[first.id]?.series ?? "").localeCompare(organization[second.id]?.series ?? "", "pt-BR") || (organization[first.id]?.volume ?? Infinity) - (organization[second.id]?.volume ?? Infinity) || first.title.localeCompare(second.title, "pt-BR");
      return second.addedDate - first.addedDate;
    });
  }, [books, filter, query, sort, organization, collection, format]);

  // Última leitura real: data de abertura, se existir, ou da última gravação de progresso (BUGS_ATUAIS 09/11).
  // Até 3 leituras recentes não concluídas (a primeira é a mais recente). Regra em `readingShelves.ts`.
  const continueBooks = useMemo(() => recentReads(books, organization, 3), [books, organization]);
  const stalledCount = useMemo(() => books.filter(book => isStalled(book, organization[book.id])).length, [books, organization]);
  const visibleFilters = stalledCount || filter === "stalled" ? [...filters, stalledFilter] : filters;

  const selectedSort =
    sorts.find((item) => item.value === sort)?.label ??
    "Adicionados recentemente";

  const paddingTop = Platform.OS === "web" ? space.xxl : Math.max(insets.top, space.lg);
  const filtersActive = Boolean(query || filter !== "all" || format !== "all" || collection);
  const clearFilters = () => { setQuery(""); setFilter("all"); setFormat("all"); setCollection(""); };
  const startSelecting = () => { setSelecting(true); setSelection(new Set()); setNotice(null); };
  const stopSelecting = () => { setSelecting(false); setSelection(new Set()); setNotice(null); };

  const addItems: ActionMenuItem[] = [
    { key: "file", label: "Importar arquivo", description: "EPUB ou PDF deste dispositivo", icon: "document-text-outline", disabled: bookImport.busy, onPress: () => void bookImport.start() },
    { key: "drive", label: "Conectar Google Drive", description: "Leia os livros das suas pastas", icon: "logo-google", onPress: () => router.push("/sources?add=drive" as never) },
    { key: "link", label: "Adicionar biblioteca por link", description: "Uma coleção de livros disponível na internet", icon: "link-outline", onPress: () => router.push("/sources?add=link" as never) },
    { key: "discover", label: "Buscar em catálogos públicos", description: "Gutenberg, Gutendex e suas fontes", icon: "compass-outline", onPress: () => router.push("/(tabs)/search" as never) },
  ];
  const moreItems: ActionMenuItem[] = [
    { key: "select", label: "Selecionar livros", description: "Organizar vários livros de uma vez", icon: "checkbox-outline", onPress: startSelecting },
    { key: "collections", label: "Coleções", description: collections.length ? `${collections.length} ${collections.length === 1 ? "coleção" : "coleções"}` : "Agrupe livros por tema", icon: "albums-outline", onPress: () => setManageCollections(true) },
    { key: "annotations", label: "Todas as anotações", description: "Grifos, notas e marcadores de todos os livros", icon: "bookmarks-outline", onPress: () => router.push("/annotations" as never) },
    { key: "sources", label: "Minhas fontes", description: "Drive e bibliotecas conectadas", icon: "cloud-outline", onPress: () => router.push("/sources" as never) },
    { key: "theme", label: resolvedTheme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro", icon: resolvedTheme === "dark" ? "sunny-outline" : "moon-outline", onPress: () => void setMode(resolvedTheme === "dark" ? "light" : "dark") },
  ];
  const formatItems: ActionMenuItem[] = (["all", "epub", "pdf"] as const).map(value => ({
    key: value, label: value === "all" ? "Todos os formatos" : value.toUpperCase(), icon: format === value ? "checkmark" : "ellipse-outline", onPress: () => setFormat(value),
  }));
  const sortItems: ActionMenuItem[] = sorts.map(item => ({
    key: item.value, label: item.label, icon: sort === item.value ? "checkmark" : "ellipse-outline", onPress: () => setSort(item.value),
  }));
  const formatLabel = format === "all" ? "Todos" : format.toUpperCase();

  const header = (
    <View style={styles.headerBlock}>
      <ScreenHeader
        title="Biblioteca"
        subtitle={`${books.length} ${books.length === 1 ? "livro" : "livros"}${bookImport.busy ? " · importando…" : ""}`}
        large
        actions={<>
          <IconButton icon="ellipsis-horizontal" label="Mais opções da biblioteca" onPress={() => setOpenMenu("more")} />
          <IconButton icon="add" label="Adicionar livros" appearance="filled" onPress={() => setOpenMenu("add")} />
        </>}
      />
      {!selecting ? <FirstStepsCard /> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por título, autor, série ou coleção" label="Buscar livros por metadados" />
      <ChipRow label="Filtrar por situação">
        {visibleFilters.map(item => <Chip key={item.value} label={item.value === "stalled" ? `${item.label} (${stalledCount})` : item.label} icon={item.value === "stalled" ? "time-outline" : undefined} selected={filter === item.value} onPress={() => setFilter(item.value)} />)}
      </ChipRow>
      {collections.length ? (
        <ChipRow label="Filtrar por coleção">
          {["", ...collections].map(name => <Chip key={name || "all"} label={name || "Todas as coleções"} icon={name ? "albums-outline" : undefined} selected={collection === name} onPress={() => setCollection(name)} />)}
        </ChipRow>
      ) : null}
      <View style={styles.toolbar}>
        <Button label={format === "all" ? "Formato" : formatLabel} variant="ghost" icon="funnel-outline" trailingIcon="chevron-down" style={styles.toolbarShrink} accessibilityLabel={`Filtrar formato: ${formatLabel}`} onPress={() => setOpenMenu("format")} />
        <Button label={sortShortLabels[sort]} variant="ghost" icon="swap-vertical-outline" style={styles.toolbarShrink} accessibilityLabel={`Ordenar livros: ${selectedSort}`} onPress={() => setOpenMenu("sort")} />
        <View style={styles.toolbarSpacer} />
        <IconButton icon={layout === "grid" ? "list-outline" : "grid-outline"} label={layout === "grid" ? "Exibir em lista" : "Exibir em grade"} onPress={() => setLayout(layout === "grid" ? "list" : "grid")} />
      </View>

      {manageCollections ? (
        <View style={styles.panel}>
          <ListGroup title="Suas coleções" footer={collections.length ? undefined : "Nenhuma coleção ainda. Uma coleção reúne pelo menos um livro."}>
            {collections.map(name => (
              <ListRow
                key={name}
                title={name}
                description={`${books.filter(book => organization[book.id]?.collections.includes(name)).length} livros`}
                icon="albums-outline"
                trailing={<Button label="Renomear" variant="ghost" disabled={!!organizationError} accessibilityLabel={`Renomear coleção ${name}`} onPress={() => setRename(name)} />}
              />
            ))}
          </ListGroup>
          <View style={styles.panelActions}>
            <Button label="Criar coleção com livros" icon="add" onPress={() => { startSelecting(); setNotice("Selecione os livros e toque em Organizar seleção para criar uma coleção. Uma coleção reúne pelo menos um livro."); setManageCollections(false); }} />
            <Button label="Fechar" variant="ghost" onPress={() => setManageCollections(false)} />
          </View>
        </View>
      ) : null}

      {selecting ? (
        <View style={[styles.selectionBar, { backgroundColor: palette.accentSoft }]}>
          <AppText variant="label" accessibilityLiveRegion="polite" style={{ flexGrow: 1 }}>{selectedIds.length} selecionados</AppText>
          <Button label="Selecionar resultados" variant="ghost" onPress={() => setSelection(new Set(visibleBooks.map(book => book.id)))} />
          <Button label="Organizar seleção" variant="primary" disabled={!selectedIds.length || !!organizationError} onPress={() => setBulkOpen(true)} />
          <IconButton icon="close" label="Encerrar seleção" onPress={stopSelecting} />
        </View>
      ) : null}
      {notice ? <AppText variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">{notice}</AppText> : null}
      {organizationError ? (
        <View style={styles.inlineError}>
          <AppText variant="bodySmall" tone="danger" accessibilityRole="alert" style={{ flex: 1 }}>{organizationError}</AppText>
          <Button label="Recarregar organização" variant="ghost" onPress={() => void loadOrganization().catch(() => undefined)} />
        </View>
      ) : null}

      {!selecting && !filtersActive && continueBooks.length ? (
        <View style={styles.shelf}>
          <AppText variant="overline" tone="accent">Continue lendo</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
            {continueBooks.map((book, index) => {
              const card = toCardBook(book, Boolean(organization[book.id]));
              return (
                <Pressable
                  key={book.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Continuar lendo ${card.title}`}
                  onPress={() => router.push({ pathname: "/reader/[bookId]", params: { bookId: book.id } })}
                  android_ripple={{ color: palette.surfaceSecondary }}
                  style={[styles.continueReading, { width: index === 0 ? Math.min(uiLayout.narrow, Math.max(260, layoutWidth - gutter * 2 - (continueBooks.length > 1 ? 56 : 0))) : 240, backgroundColor: palette.surface, borderColor: palette.border }]}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                    <AppText variant={index === 0 ? "heading" : "label"} numberOfLines={2}>{card.title}</AppText>
                    <AppText variant="caption" tone="secondary" numberOfLines={1}>{card.author}{book.progress > 0 ? ` · ${Math.round(book.progress * 100)}%` : ""}</AppText>
                    {book.progress > 0 ? <View style={[styles.shelfTrack, { backgroundColor: palette.surfaceSecondary }]}><View style={{ height: 3, width: `${Math.round(book.progress * 100)}%`, backgroundColor: palette.accent }} /></View> : null}
                  </View>
                  {index === 0 ? <View style={[styles.continueIcon, { backgroundColor: palette.accent }]}><Ionicons name="arrow-forward" size={20} color={palette.onAccent} /></View> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      onLayout={event => setLayoutWidth(event.nativeEvent.layout.width)}
      style={[styles.screen, { backgroundColor: palette.background }]}
    >
      {(status === "loading" || status === "idle") && books.length === 0 ? (
        <View style={[styles.frame, { paddingHorizontal: gutter, paddingTop }]}>
          {header}
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} />
            <AppText variant="bodySmall" tone="secondary">Carregando biblioteca…</AppText>
          </View>
        </View>
      ) : null}
      {status === "error" ? (
        <View style={[styles.frame, { paddingHorizontal: gutter, paddingTop }]}>
          {header}
          <EmptyState icon="alert-circle-outline" title="Não foi possível carregar a biblioteca." description={error ?? undefined}>
            <Button label="Tentar novamente" onPress={() => void reload()} />
          </EmptyState>
        </View>
      ) : null}
      {status !== "error" && (status === "success" || books.length > 0) ? (
        <FlatList
          data={visibleBooks}
          key={`columns-${columns}-${layout}`}
          numColumns={columns}
          keyExtractor={(book) => book.id}
          renderItem={renderBook}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter, paddingTop }]}
          columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon={books.length === 0 ? "library-outline" : "search-outline"}
              title={books.length === 0 ? "Sua estante começa aqui" : "Nenhum livro encontrado"}
              description={books.length === 0 ? "Importe um EPUB ou PDF, conecte o Google Drive ou busque em catálogos públicos." : "Tente outro termo ou remova os filtros."}
            >
              {books.length ? <Button label="Limpar filtros" onPress={clearFilters} /> : <Button label="Adicionar livros" icon="add" variant="primary" onPress={() => setOpenMenu("add")} />}
            </EmptyState>
          }
        />
      ) : null}
      <ActionMenu visible={openMenu === "add"} title="Adicionar livros" items={addItems} onClose={() => setOpenMenu(null)} />
      <ActionMenu visible={openMenu === "more"} title="Biblioteca" items={moreItems} onClose={() => setOpenMenu(null)} />
      <ActionMenu visible={openMenu === "format"} title="Formato" items={formatItems} onClose={() => setOpenMenu(null)} />
      <ActionMenu visible={openMenu === "sort"} title="Ordenar livros" items={sortItems} onClose={() => setOpenMenu(null)} />
      {organizing ? <BookOrganizationModal book={organizing} record={organization[organizing.id]} onClose={() => setOrganizing(null)} onSaved={refreshOrganization} /> : null}
      {bulkOpen || rename ? <LibraryBulkModal bookIds={rename ? books.filter(book => organization[book.id]?.collections.includes(rename)).map(book => book.id) : selectedIds} collections={collections} rename={rename ?? undefined} onClose={() => { setBulkOpen(false); setRename(null); }} onSaved={async (count, replacement) => {
        await refreshOrganization(); if (rename && collection === rename && replacement) setCollection(replacement);
        setNotice(`${count} ${count === 1 ? 'livro atualizado' : 'livros atualizados'}. ${count ? 'As alterações estão salvas no dispositivo.' : 'A organização já estava atualizada.'}`);
        setSelecting(false); setSelection(new Set());
      }} /> : null}
      <BookImportModal
        state={bookImport.state}
        onCancel={bookImport.cancel}
        onClose={bookImport.dismiss}
        onImportAnother={() => { bookImport.dismiss(); void bookImport.start(); }}
        duplicate={bookImport.duplicate}
        restoredTitle={bookImport.restored ? bookImport.importedBook?.title ?? null : null}
        onOpenDuplicate={bookImport.openDuplicate}
        onImportDuplicate={bookImport.importDuplicateAnyway}
        onOpenBook={() => {
          const bookId = bookImport.importedBook?.id;
          bookImport.dismiss();
          if (bookId) router.push({ pathname: "/reader/[bookId]", params: { bookId } });
        }}
      />
    </View>
  );
}

interface LibraryBookCellProps {
  item: LibraryBook;
  record: BookOrganization | undefined;
  selecting: boolean;
  selected: boolean;
  layout: "grid" | "list";
  cellWidth: number;
  palette: ReturnType<typeof useAppTheme>["palette"];
  themeMode: ReturnType<typeof useAppTheme>["resolvedTheme"];
  organizationDisabled: boolean;
  onOpen(item: LibraryBook): void;
  onToggle(id: string): void;
  onOrganize(item: LibraryBook, card: Book): void;
}

/**
 * Uma célula da grade/lista. Memoizada: digitar na busca, abrir menus ou marcar um livro não redesenha os demais cartões
 * (com 1000 livros, cada mudança redesenhava todos os ~72 cartões montados). Só recebe dados do próprio livro e callbacks estáveis.
 */
const LibraryBookCell = memo(function LibraryBookCell({ item, record, selecting, selected, layout, cellWidth, palette, themeMode, organizationDisabled, onOpen, onToggle, onOrganize }: LibraryBookCellProps) {
  const cardBook = useMemo(() => toCardBook(item, Boolean(record)), [item, record]);
  const open = useCallback(() => onOpen(item), [item, onOpen]);
  const toggle = useCallback(() => onToggle(item.id), [item.id, onToggle]);
  return (
    <View style={{ width: cellWidth, minWidth: 0, gap: space.xs, marginBottom: space.lg }}>
      {selecting ? <SharedBookCard layout={layout} book={cardBook} themeMode={themeMode} colors={palette} selection={selected} onPress={toggle} /> : <>
        <SharedBookCard layout={layout} book={cardBook} themeMode={themeMode} colors={palette} onPress={open} />
        {/* Uma linha só: situação de leitura · disponibilidade, e o menu "⋯" com abrir, organizar e remover. */}
        <BookCloudControls book={item} title={cardBook.title} organizeDisabled={organizationDisabled} onOpen={open} onOrganize={() => onOrganize(item, cardBook)}
          status={`${record?.favorite ? "★ · " : ""}${readingStatusLabels[inferredReadingStatus(item, record)]}${record?.series ? ` · ${record.series}${record.volume ? ` ${record.volume}` : ""}` : ""}`} />
      </>}
    </View>
  );
});

function toCardBook(book: LibraryBook, hasOrganization = false): Book {
  const mockBook = catalogBookFor(book);
  return {
    id: book.id,
    title: hasOrganization ? book.title : mockBook?.title ?? book.title,
    author: hasOrganization ? book.author : mockBook?.author ?? book.author,
    format: book.mimeType === "application/pdf" ? "pdf" : "epub",
    coverUri: hasOrganization ? book.coverImagePath ?? mockBook?.coverUri : mockBook?.coverUri ?? book.coverImagePath ?? undefined,
    fileUri: book.filePath,
    progress: book.progress,
  };
}


const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%" },
  frame: { width: "100%", flex: 1 },
  headerBlock: { gap: space.md, marginBottom: space.lg },
  toolbar: { flexDirection: "row", alignItems: "center", gap: space.xs, marginLeft: -space.sm },
  toolbarShrink: { flexShrink: 1, minWidth: 0 },
  toolbarSpacer: { flexGrow: 1 },
  panel: { gap: space.md },
  panelActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  selectionBar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, padding: space.sm, paddingLeft: space.lg, borderRadius: radius.lg },
  inlineError: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  continueReading: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, },
  continueIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  shelf: { gap: space.sm, marginTop: space.xs },
  shelfRow: { gap: space.md, paddingRight: space.lg },
  shelfTrack: { height: 3, borderRadius: 2, overflow: "hidden", marginTop: space.xs },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 36 },
  loading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.section },
  list: { paddingBottom: space.xxxl },
  gridRow: { justifyContent: "flex-start", gap: space.md },
});
