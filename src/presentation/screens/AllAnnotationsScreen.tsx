import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { AppText, Chip, ChipRow, EmptyState, Screen, ScreenHeader, SearchField } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { appDependencies } from "@/src/presentation/services/dependencies";
import { readableBookTitle } from "@/src/presentation/services/bookDisplay";
import { readHighlightLocation } from "@/src/domain/usecases/StudyHighlights";
import { AnnotationItem, AnnotationKind, collectAnnotations, filterAnnotations } from "@/src/domain/study/allAnnotations";
import { studyColorSwatches } from "@/src/presentation/components/StudyPanelControls";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";

type Filter = AnnotationKind | "all" | "pinned";
const filters: Array<[Filter, string]> = [["all", "Tudo"], ["pinned", "Fixados"], ["highlight", "Grifos"], ["bookmark", "Marcadores"]];

/**
 * Todas as anotações (FASE 3, A2): grifos, notas e marcadores dos livros da conta numa lista com busca. Tocar abre o livro;
 * dentro dele o painel de grifos/marcadores leva ao trecho. Só lê: editar e excluir continuam no painel do livro.
 */
export function AllAnnotationsScreen() {
  const { palette } = useAppTheme();
  const [items, setItems] = useState<AnnotationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(""), [filter, setFilter] = useState<Filter>("all");
  const run = useRef(0);

  const load = useCallback(async () => {
    const current = ++run.current, account = libraryAccountScope.capture();
    setError(null);
    try {
      const books = await appDependencies.bookRepository.listActive();
      const sources = await Promise.all(books.filter(book => !book.isDeleted).map(async book => ({
        book: { id: book.id, title: readableBookTitle(book) },
        highlights: await appDependencies.highlightRepository.listByBookId(book.id),
        bookmarks: await appDependencies.bookmarkRepository.listByBookId(book.id),
      })));
      account.check();
      if (run.current === current) setItems(collectAnnotations(sources, highlight => readHighlightLocation(highlight)));
    } catch (failure) {
      if (run.current === current) setError(failure instanceof Error ? failure.message : "Não foi possível carregar as anotações.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = items ? filterAnnotations(items, query, filter) : [];
  return (
    <Screen header={<ScreenHeader title="Todas as anotações" subtitle="Grifos, notas e marcadores dos seus livros" back />}>
      {error ? <EmptyState icon="alert-circle-outline" title="Não foi possível carregar" description={error} /> : null}
      {!error && items === null ? <AppText tone="secondary">Carregando anotações…</AppText> : null}
      {items && items.length === 0 ? <EmptyState icon="bookmark-outline" title="Nenhuma anotação ainda" description="Grife um trecho ou crie um marcador dentro de um livro e ele aparece aqui." /> : null}
      {items && items.length > 0 ? <>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar em trechos, notas e livros" label="Buscar nas anotações" />
        <ChipRow label="Mostrar">{filters.map(([value, label]) => <Chip key={value} label={label} selected={filter === value} onPress={() => setFilter(value)} />)}</ChipRow>
        {!visible.length ? <AppText tone="secondary">Nenhuma anotação corresponde à busca.</AppText> : null}
        {visible.map(item => (
          <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`Abrir ${item.bookTitle}: ${item.text.slice(0, 80)}`}
            onPress={() => router.push({ pathname: "/reader/[bookId]", params: { bookId: item.bookId } })}
            style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <View style={styles.meta}>
              {item.color ? <View style={[styles.dot, { backgroundColor: studyColorSwatches[item.color] }]} /> : null}
              <AppText variant="caption" tone="secondary" numberOfLines={2}>
                {[item.pinned ? "Fixado" : null, item.kind === "bookmark" ? "Marcador" : "Grifo", item.bookTitle, item.chapterTitle].filter(Boolean).join(" · ")}
              </AppText>
            </View>
            <AppText>{item.text}</AppText>
            {item.note ? <AppText tone="secondary">{item.note}</AppText> : null}
          </Pressable>
        ))}
      </> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 6, minHeight: 44 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
