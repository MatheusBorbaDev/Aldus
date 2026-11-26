import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserSource } from "@/src/domain/types/sources";
import { SourceCatalogItem, SourceFolder, sourceIdentity } from "@/src/domain/types/sourceCatalog";
import { enterSourceFolder, sourceFolderContents, sourceFolderRoute, sourceFolderTrail, sourceTreeIndex } from "@/src/domain/sources/sourceTree";
import { SourceCatalogSort, querySourceCatalog, querySourceCatalogAsync, SOURCE_RECONNECT_MESSAGE, SOURCE_REFRESH_FAILED_MESSAGE } from "@/src/data/sources/SourceCatalogService";
import { sourceCatalogs } from "@/src/data/sources/sourceCatalogDependencies";
import { useSourceCatalog } from "@/src/presentation/hooks/useSourceCatalog";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { ActionMenu, ActionMenuItem, AppText, Button, EmptyState, IconButton, IconName, layout as uiLayout, radius, SearchField, space, touchTarget } from "@/src/ui";
import { BookCard } from "./BookCard";
import { SourceManagerModal, SourceManagerAction } from "./SourceManagerModal";
import { sourceLibraryTypeLabel, sourceProgressCounts, sourceProgressLabel, sourceUpdatedLabel, sourceVisibleInAccount, useSourceAccountGeneration, useSourceAccountId } from './sourcePresentation';
import { SourceBookSheet } from "./SourceBookSheet";
import { useSourceImports } from "@/src/presentation/hooks/useSourceImports";
import { useDownloadStore } from "@/src/presentation/stores/downloadStore";
import { sourceAcquisitionState, sourceItemJob } from "@/src/presentation/services/sourceAcquisition";
import { sourcePerformance } from "@/src/utils/sourcePerformance";

type LibraryRow = { type: "folder"; folder: SourceFolder } | { type: "book"; book: SourceCatalogItem };
const sorts = [["az", "Título A–Z"], ["za", "Título Z–A"], ["recent", "Mais recentes"]] as const;
const plural = (count: number, one: string, many: string) => `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`;

const CatalogCard = memo(function CatalogCard({ item, layout, onSelect, statusLabel, showPath, columns }: { item: SourceCatalogItem; layout: "grid" | "list"; onSelect: (item: SourceCatalogItem) => void; statusLabel: string; showPath: boolean; columns: number }) {
  const { resolvedTheme, palette } = useAppTheme();
  return (
    <View style={[styles.cell, { maxWidth: `${100 / columns}%` }]}>
      <BookCard book={{ id: item.remoteBookId, title: item.title, author: item.author ?? "Autor não informado", format: item.format === "pdf" ? "pdf" : "epub", coverUri: item.coverUrl, fileUri: "", progress: 0 }} showProgress={false} statusLabel={statusLabel} layout={layout} themeMode={resolvedTheme} colors={palette} onPress={() => onSelect(item)} />
      {showPath && item.parentFolderId ? <AppText variant="caption" tone="secondary" numberOfLines={2} style={styles.path}>{item.relativeFolderPath || "Raiz da fonte"}</AppText> : null}
    </View>
  );
});

/** Biblioteca inexistente, removida ou de outra conta: uma mensagem e um caminho de volta. */
export function SourceLibraryUnavailable({ title, description }: { title: string; description: string }) {
  const { palette } = useAppTheme(), insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: Math.max(insets.top, space.lg) }]}>
      <EmptyState icon="library-outline" title={title} description={description}>
        <Button label="Voltar às minhas bibliotecas" icon="arrow-back" onPress={() => router.replace("/sources" as never)} />
      </EmptyState>
    </View>
  );
}

export function SourceLibraryScreen({ source }: { source: UserSource }) {
  const accountId = useSourceAccountId(), generation = useSourceAccountGeneration();
  if (!sourceVisibleInAccount(source, accountId)) return <SourceLibraryUnavailable title="Biblioteca indisponível" description="Esta biblioteca não está disponível nesta conta." />;
  return <SourceLibraryContent key={`${accountId}:${generation}:${source.id}`} source={source} />;
}

interface StatusNotice {
  tone: "info" | "warning" | "error";
  title: string;
  detail?: string | null;
  busy?: boolean;
  /** Uma faixa fina (reconectar, sem conexão): o estado é dito sem empurrar os livros para baixo da dobra. */
  compact?: boolean;
  action?: { label: string; accessibilityLabel?: string; onPress(): void };
}

/** O único aviso de estado da tela (carregando, reconectar, falha, sem conexão). Substitui as mensagens empilhadas. */
function SourceStatusNotice({ notice }: { notice: StatusNotice }) {
  const { palette } = useAppTheme();
  const icon: IconName = notice.tone === "error" ? "alert-circle-outline" : notice.tone === "warning" ? "cloud-offline-outline" : "information-circle-outline";
  const ink = notice.tone === "error" ? palette.danger : notice.tone === "warning" ? palette.accent : palette.secondaryText;
  if (notice.compact) return (
    <View accessibilityRole={notice.tone === "info" ? undefined : "alert"} accessibilityLiveRegion="polite" style={[styles.compactNotice, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <Ionicons name={icon} size={18} color={ink} />
      <View style={styles.noticeText}>
        <AppText variant="bodySmall" style={{ color: palette.text, fontWeight: "600" }}>{notice.title}</AppText>
        {notice.detail ? <AppText variant="caption" tone="secondary">{notice.detail}</AppText> : null}
      </View>
      {notice.action ? <Pressable accessibilityRole="button" accessibilityLabel={notice.action.accessibilityLabel ?? notice.action.label} onPress={notice.action.onPress} style={styles.compactAction}>
        <AppText variant="label" tone="accent">{notice.action.label}</AppText>
      </Pressable> : null}
    </View>
  );
  return (
    <View accessibilityRole={notice.tone === "info" ? undefined : "alert"} accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: notice.tone === "info" ? palette.surfaceSecondary : palette.accentSoft, borderColor: notice.tone === "info" ? palette.border : ink }]}>
      <View style={styles.noticeRow}>
        {notice.busy ? <ActivityIndicator size="small" color={palette.accent} /> : <Ionicons name={icon} size={20} color={ink} />}
        <View style={styles.noticeText}>
          <AppText variant="label">{notice.title}</AppText>
          {notice.detail ? <AppText variant="bodySmall" tone="secondary">{notice.detail}</AppText> : null}
        </View>
      </View>
      {notice.action ? <Button label={notice.action.label} accessibilityLabel={notice.action.accessibilityLabel} onPress={notice.action.onPress} style={styles.noticeAction} /> : null}
    </View>
  );
}

function SourceLibraryContent({ source }: { source: UserSource }) {
  const { palette } = useAppTheme(), insets = useSafeAreaInsets(), view = useSourceCatalog(source);
  const { width: windowWidth } = useWindowDimensions();
  const openedAt = useRef(performance.now()), measuredFrame = useRef(false);
  useEffect(() => {
    if (!view.catalog || measuredFrame.current) return;
    const frame = requestAnimationFrame(() => { measuredFrame.current = true; sourcePerformance('initial_frame', openedAt.current, view.catalog!.items.length); });
    return () => cancelAnimationFrame(frame);
  }, [view.catalog]);
  const { imported, error: importError, reload } = useSourceImports(source.id);
  const jobs = useDownloadStore(state => state.jobs);
  const labels = { remote_only: "Remoto · importar sob demanda", downloading: "Importando…", imported: "Na biblioteca", unavailable: "Indisponível" };
  const [query, setQuery] = useState(""), [sort, setSort] = useState<SourceCatalogSort>("az"), [layout, setLayout] = useState<"grid" | "list">("grid"), [managing, setManaging] = useState<SourceManagerAction | null>(null), [selected, setSelected] = useState<SourceCatalogItem | null>(null), [menu, setMenu] = useState(false), [sortMenu, setSortMenu] = useState(false);
  const [width, setWidth] = useState(windowWidth);
  const gutter = uiLayout.gutter(width);
  // Cada célula tem `space.xs` de respiro dos dois lados; a lista desconta isso do gutter para alinhar com o cabeçalho.
  const columns = layout === "list" ? 1 : Math.max(2, Math.min(6, Math.floor((width - gutter * 2) / 180)));
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<{ input: SourceCatalogItem[]; query: string; sort: SourceCatalogSort; items: SourceCatalogItem[] } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  useEffect(() => {
    const input = view.catalog?.items;
    setSearchError(null);
    if (!input || !query.trim()) { setSearchResult(null); return; }
    const controller = new AbortController();
    void querySourceCatalogAsync(input, query, sort, controller.signal).then(items => {
      if (!controller.signal.aborted) setSearchResult({ input, query, sort, items });
    }).catch(() => {
      if (!controller.signal.aborted) { setSearchResult({ input, query, sort, items: [] }); setSearchError('Não foi possível concluir a pesquisa. Tente novamente.'); }
    });
    return () => controller.abort();
  }, [view.catalog?.items, query, sort]);
  const refreshOperation = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => () => { refreshOperation.current?.abort(); refreshOperation.current = null; }, []));
  const identity = sourceIdentity(source);
  useEffect(() => { setFolderIds([]); setQuery(""); setSelected(null); }, [source.id, identity]);
  const trail = useMemo(() => view.catalog ? sourceFolderTrail(view.catalog, folderIds) : [], [view.catalog, folderIds]);
  const currentFolder = trail.at(-1), searching = !!query.trim(), insideFolder = trail.length > 1;
  const contents = useMemo(() => view.catalog ? sourceFolderContents(view.catalog, currentFolder?.remoteFolderId) : { folders: [], books: [] }, [view.catalog, currentFolder]);
  const items = useMemo(() => searching ? searchResult && searchResult.input === view.catalog?.items && searchResult.query === query && searchResult.sort === sort ? searchResult.items : [] : querySourceCatalog(contents.books, '', sort), [view.catalog, contents, searching, query, sort, searchResult]);
  const searchingItems = searching && !(searchResult && searchResult.input === view.catalog?.items && searchResult.query === query && searchResult.sort === sort);
  const folders = useMemo(() => searching && view.catalog ? sourceTreeIndex(view.catalog).searchFolders(query) : contents.folders, [view.catalog, contents, searching, query]);
  const rows = useMemo<LibraryRow[]>(() => {
    const folderRows = folders.map(folder => ({ type: "folder" as const, folder })), bookRows = items.map(book => ({ type: "book" as const, book }));
    return searching ? [...bookRows, ...folderRows] : [...folderRows, ...bookRows];
  }, [folders, items, searching]);
  const parentIds = useCallback(() => trail.slice(1, -1).map(folder => folder.id), [trail]);
  const goBack = useCallback(() => { if (trail.length > 1) { setFolderIds(parentIds()); setQuery(""); } else router.replace("/sources" as never); }, [trail, parentIds]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selected || managing) return false;
      goBack(); return true;
    });
    return () => subscription.remove();
  }, [trail, selected, managing, goBack]));
  const openFolder = (folder: SourceFolder) => {
    setFolderIds(searching && view.catalog ? sourceFolderRoute(view.catalog, folder.id) : enterSourceFolder(trail, folder));
    setQuery("");
  };
  const updating = view.status === "loading" || view.status === "refreshing";
  const reconnect = view.status === "auth_required" || !source.enabled;
  const refresh = () => {
    if (updating) return;
    if (reconnect) { setManaging('reconnect'); return; }
    const controller = new AbortController(); refreshOperation.current = controller;
    void sourceCatalogs.refresh(source, controller.signal).finally(() => { if (refreshOperation.current === controller) refreshOperation.current = null; });
  };

  // Mensagens específicas (ex.: erro do Drive, falha ao remover) aparecem como estão; as genéricas viram um aviso curto.
  const specificError = view.error && view.error !== SOURCE_REFRESH_FAILED_MESSAGE && view.error !== SOURCE_RECONNECT_MESSAGE ? view.error : null;
  const notice: StatusNotice | null = updating ? {
    tone: "info", busy: true,
    title: sourceProgressLabel(view.operation) ?? (view.status === 'refreshing' ? 'Atualizando catálogo; livros conhecidos continuam disponíveis…' : 'Carregando catálogo…'),
    detail: sourceProgressCounts(view.operation),
    action: refreshOperation.current ? { label: "Cancelar atualização", accessibilityLabel: "Cancelar atualização da biblioteca", onPress: () => refreshOperation.current?.abort() } : undefined,
  } : view.status === "auth_required" ? {
    tone: "warning", compact: true, title: "Reconecte o Google Drive para atualizar.",
    detail: [view.catalog ? "Os livros já listados continuam aqui." : null, specificError].filter(Boolean).join(" ") || null,
    action: { label: "Reconectar", accessibilityLabel: "Reconectar o Google Drive", onPress: refresh },
  } : view.status === "error" && !view.catalog ? {
    tone: "error", title: "Não foi possível carregar esta biblioteca.",
    detail: specificError ?? "Confira a conexão e as permissões da fonte. Se o limite de consultas foi atingido, aguarde e tente de novo.",
    action: { label: "Tentar novamente", accessibilityLabel: "Tentar carregar a biblioteca novamente", onPress: refresh },
  } : specificError ? {
    tone: "error", title: specificError,
  } : view.error ? {
    tone: "warning", title: "Não foi possível atualizar.",
    detail: "Exibindo a última atualização disponível. Confira a rede e as permissões; se o limite de consultas foi atingido, aguarde e tente de novo.",
  } : view.status === "offline" ? {
    tone: "info", compact: true, title: "Sem conexão.", detail: "Exibindo a última atualização disponível.",
  } : null;

  const catalogSummary = view.catalog
    ? [plural(view.catalog.items.length, "livro", "livros"), view.catalog.rootFolderId ? plural(Math.max(0, (view.catalog.folders?.length ?? 1) - 1), "pasta", "pastas") : null, sourceLibraryTypeLabel(source.kind)].filter(Boolean).join(" · ")
    : `${sourceLibraryTypeLabel(source.kind)} · Ainda não atualizada`;
  const folderSummary = [plural(contents.books.length, "livro", "livros"), contents.folders.length ? plural(contents.folders.length, "pasta", "pastas") : null].filter(Boolean).join(" · ") + " nesta pasta";
  const updatedLabel = sourceUpdatedLabel(view.catalog?.lastUpdated);
  const sortLabel = sorts.find(([value]) => value === sort)?.[1] ?? "Título A–Z";
  // Drive pelo link (26/11/2026): não há conta conectada para anunciar.
  const connectedLabel: string | null = null;
  const menuItems: ActionMenuItem[] = [
    { key: "manage", label: "Gerenciar biblioteca", icon: "settings-outline", onPress: () => setManaging("manage") },
    { key: "edit", label: "Editar biblioteca", icon: "create-outline", onPress: () => setManaging("edit") },
    { key: "remove", label: "Remover biblioteca", description: "Livros já importados continuam na sua Biblioteca.", icon: "trash-outline", onPress: () => setManaging("remove") },
  ];

  const header = <View style={styles.header}>
    <View style={styles.navRow}>
      <IconButton icon="arrow-back" label={insideFolder ? "Voltar para a pasta anterior" : "Voltar para Minhas bibliotecas"} onPress={goBack} style={styles.back} />
      <View style={styles.spacer} />
      <IconButton icon={reconnect ? "log-in-outline" : "refresh"} label={reconnect ? "Reconectar" : "Atualizar"} disabled={updating} onPress={refresh} />
      <IconButton icon="ellipsis-horizontal" label={`Opções da biblioteca ${source.name}`} expanded={menu} onPress={() => setMenu(true)} />
    </View>
    <View style={styles.titles}>
      {insideFolder ? <View accessibilityLabel="Caminho da pasta" style={styles.crumbs}>
        {trail.slice(0, -1).map((folder, index) => <View key={folder.id} style={styles.crumb}>
          {index ? <AppText variant="bodySmall" tone="secondary">›</AppText> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={index ? `Ir para pasta: ${folder.name}` : "Ir para raiz da fonte"} onPress={() => { setFolderIds(trail.slice(1, index + 1).map(parent => parent.id)); setQuery(""); }} style={styles.crumbButton}>
            <AppText variant="bodySmall" tone="accent" numberOfLines={1}>{index ? folder.name : source.name}</AppText>
          </Pressable>
        </View>)}
      </View> : null}
      <AppText variant="title" accessibilityRole="header">{insideFolder && currentFolder ? currentFolder.name : source.name}</AppText>
      <AppText variant="bodySmall" tone="secondary">{insideFolder ? folderSummary : catalogSummary}</AppText>
      {connectedLabel || updatedLabel ? <View style={styles.connection}>
        {connectedLabel ? <View style={[styles.connectionDot, { backgroundColor: palette.success ?? palette.accent }]} /> : null}
        <AppText variant="caption" tone="secondary">{[connectedLabel, updatedLabel].filter(Boolean).join(" · ")}</AppText>
      </View> : null}
    </View>
    {notice ? <SourceStatusNotice notice={notice} /> : null}
    {source.kind === "google-drive" && view.catalog && !view.catalog.rootFolderId ? <AppText variant="caption" tone="secondary">Atualize a fonte para incluir pastas e subpastas. O catálogo anterior continua disponível.</AppText> : null}
    {importError ? <AppText variant="bodySmall" tone="danger" accessibilityRole="alert">{importError}</AppText> : null}
    {/* Sem catálogo não há o que pesquisar nem ordenar: só o aviso/estado vazio e a ação de atualizar. */}
    {view.catalog ? <>
      <SearchField value={query} onChangeText={setQuery} placeholder="Pesquisar por título ou autor" label="Pesquisar nesta biblioteca" />
      <View style={styles.toolbar}>
        {/* Um botão só para ordenar: os três botões lado a lado ficavam cortados no celular (18/11). */}
        <Pressable accessibilityRole="button" accessibilityLabel={`Ordenar livros: ${sortLabel}`} onPress={() => setSortMenu(true)} style={[styles.sortButton, { borderColor: palette.border }]}>
          <Ionicons name="swap-vertical-outline" size={17} color={palette.accent} />
          <AppText variant="label" numberOfLines={1}>{sortLabel}</AppText>
          <Ionicons name="chevron-down" size={15} color={palette.secondaryText} />
        </Pressable>
        <View style={styles.spacer} />
        <IconButton icon={layout === "grid" ? "list-outline" : "grid-outline"} label={layout === "grid" ? "Exibir em lista" : "Exibir em grade"} onPress={() => setLayout(layout === "grid" ? "list" : "grid")} />
      </View>
    </> : null}
    {searching ? <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">{searchingItems ? 'Pesquisando na biblioteca…' : `Resultados em toda a biblioteca · ${plural(items.length, "livro", "livros")} · ${plural(folders.length, "pasta", "pastas")}`}</AppText> : null}
    {searchError ? <AppText variant="bodySmall" tone="danger" accessibilityRole="alert">{searchError}</AppText> : null}
  </View>;

  // O aviso de estado já explica falha, reconexão e carregamento; a lista vazia não repete a mesma mensagem.
  const empty = updating || searchingItems || (!view.catalog && (view.status === "error" || view.status === "auth_required")) ? null
    : searching ? <EmptyState icon="search-outline" title="Nenhum resultado nesta fonte" description="Experimente outro título ou autor." />
    : insideFolder ? <EmptyState icon="folder-open-outline" title="Pasta vazia" description="Esta pasta não contém livros ou subpastas." />
    : view.catalog ? <EmptyState icon="library-outline" title="Nenhum EPUB ou PDF foi encontrado nesta fonte." description="Adicione arquivos à fonte e use Atualizar." />
    : <EmptyState icon="cloud-download-outline" title="Biblioteca ainda não atualizada" description="Use Atualizar para obter o catálogo. Nada será baixado durante a indexação.">
        <Button label="Atualizar agora" icon="refresh" variant="primary" onPress={refresh} />
      </EmptyState>;

  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.fill, { backgroundColor: palette.background, paddingTop: Math.max(insets.top, space.md), paddingBottom: insets.bottom }]}>
    <FlatList key={`${layout}-${columns}-${currentFolder?.id ?? "root"}`} data={rows} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" numColumns={columns} keyExtractor={row => row.type === "folder" ? `folder:${row.folder.id}` : `book:${row.book.remoteBookId}`} initialNumToRender={12} maxToRenderPerBatch={10} windowSize={5} contentContainerStyle={{ paddingHorizontal: gutter - space.xs, paddingBottom: space.xxl }} renderItem={({ item: row }) => {
      if (row.type === "book") return <CatalogCard columns={columns} item={row.book} layout={layout} onSelect={setSelected} showPath={searching} statusLabel={labels[sourceAcquisitionState(row.book, imported[row.book.remoteBookId], sourceItemJob(row.book, jobs))]} />;
      const folder = row.folder, children = view.catalog ? sourceFolderContents(view.catalog, folder.remoteFolderId) : null;
      return <View style={[styles.cell, { maxWidth: `${100 / columns}%` }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir pasta: ${folder.name}`} onPress={() => openFolder(folder)} android_ripple={{ color: palette.separator }} style={[styles.folder, layout === "list" ? styles.folderRow : null, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Ionicons name={folder.isShortcut ? "arrow-redo-outline" : "folder-outline"} size={28} color={palette.accent} />
          <View style={styles.folderText}>
            <AppText variant="label" numberOfLines={2}>{folder.name}</AppText>
            <AppText variant="caption" tone="secondary">{folder.isShortcut ? "Atalho · " : ""}{children ? plural(children.folders.length + children.books.length, "item conhecido", "itens conhecidos") : "Pasta"}</AppText>
            {searching ? <AppText variant="caption" tone="secondary" numberOfLines={2}>{folder.relativePath}</AppText> : null}
          </View>
        </Pressable>
      </View>;
    }} ListEmptyComponent={empty} />
    <ActionMenu visible={menu} title={source.name} items={menuItems} onClose={() => setMenu(false)} />
    <ActionMenu visible={sortMenu} title="Ordenar livros" items={sorts.map(([value, label]) => ({ key: value, label, icon: sort === value ? "checkmark-circle" : "ellipse-outline", onPress: () => { setSort(value); setSortMenu(false); } }))} onClose={() => setSortMenu(false)} />
    <SourceManagerModal visible={managing !== null} sourceId={source.id} action={managing ?? 'manage'} onClose={() => setManaging(null)} />
    {selected ? <SourceBookSheet key={selected.remoteBookId} source={source} item={selected} importedBookId={imported[selected.remoteBookId]} onImported={reload} onClose={() => setSelected(null)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: space.xs, paddingBottom: space.md, gap: space.md },
  navRow: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: touchTarget },
  back: { marginLeft: -space.md + 2 },
  spacer: { flex: 1 },
  titles: { gap: space.xxs },
  crumbs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.xs },
  crumb: { flexDirection: "row", alignItems: "center", gap: space.xs, maxWidth: "100%" },
  crumbButton: { minHeight: touchTarget, justifyContent: "center", flexShrink: 1 },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  noticeText: { flex: 1, minWidth: 0, gap: space.xxs },
  noticeAction: { marginLeft: space.xxl + space.xxs },
  compactNotice: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.xs, minHeight: touchTarget },
  compactAction: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: space.xs },
  connection: { flexDirection: "row", alignItems: "center", gap: space.xs },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  sortButton: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: space.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, flexShrink: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: space.xs },
  toolbarChips: { flex: 1, minWidth: 0 },
  cell: { flex: 1, padding: space.xs },
  path: { paddingTop: space.xs },
  folder: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm, minHeight: 110 },
  folderRow: { flexDirection: "row", alignItems: "center", minHeight: touchTarget + space.xl },
  folderText: { flexShrink: 1, minWidth: 0, gap: space.xxs },
});
