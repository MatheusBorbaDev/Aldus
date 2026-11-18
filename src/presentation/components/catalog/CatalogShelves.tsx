import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, Chip } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { catalog } from "@/src/data/catalog/catalogDependencies";
import { CatalogUnavailableError } from "@/src/data/catalog/catalogSources";
import { ALDUS_CATEGORIES, AldusCategory, CatalogBook } from "@/src/domain/catalog/catalogBook";
import { CATEGORY_QUERIES, INITIAL_SHELVES, MORE_SHELVES, Recommendation, libraryAffinity, recommendFor } from "@/src/domain/catalog/catalogShelves";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { OrganizationRecords } from "@/src/domain/types/libraryOrganization";
import { BookCover } from "@/src/presentation/components/BookCover";

/**
 * Vitrine do catálogo (fase 4, 18/11/2026): "Para você" calculado neste aparelho, fileiras por categoria iguais para todos e
 * atalhos para as outras categorias, que só carregam quando tocadas. Sem números na tela.
 */
export function CatalogShelves({ library, organization, onOpen, onBrowse }: {
  library: LibraryBook[]; organization: OrganizationRecords; onOpen: (book: CatalogBook) => void; onBrowse: (category: AldusCategory) => void;
}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const refreshRecommendations = useCallback(() => {
    catalog.cachedBooks().then(candidates => {
      const owned = new Set(library.map(book => book.catalogId).filter((id): id is string => !!id));
      setRecommendations(recommendFor(candidates, libraryAffinity(library, organization), owned));
    }).catch(() => setRecommendations([]));
  }, [library, organization]);
  useEffect(() => { refreshRecommendations(); }, [refreshRecommendations]);

  return (
    <View style={styles.wrap}>
      {recommendations.length >= 3 ? (
        <View style={styles.section}>
          <AppText variant="title" accessibilityRole="header">Para você</AppText>
          <AppText variant="caption" tone="secondary">Com base nas categorias dos livros da sua estante. Calculado neste aparelho.</AppText>
          <ShelfRow books={recommendations.map(item => item.book)} captions={recommendations.map(item => ALDUS_CATEGORIES[item.because])} onOpen={onOpen} />
        </View>
      ) : null}
      {INITIAL_SHELVES.map(category => <CategoryShelf key={category} category={category} onOpen={onOpen} onLoaded={refreshRecommendations} />)}
      <View style={styles.section}>
        <AppText variant="label" accessibilityRole="header">Mais categorias</AppText>
        <View style={styles.chips}>{MORE_SHELVES.map(category => <Chip key={category} label={ALDUS_CATEGORIES[category]} onPress={() => onBrowse(category)} />)}</View>
      </View>
    </View>
  );
}

function CategoryShelf({ category, onOpen, onLoaded }: { category: AldusCategory; onOpen: (book: CatalogBook) => void; onLoaded: () => void }) {
  const [books, setBooks] = useState<CatalogBook[] | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    catalog.search(CATEGORY_QUERIES[category], controller.signal)
      .then(found => { if (!controller.signal.aborted) { setBooks(found); onLoaded(); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof CatalogUnavailableError ? failure.message : "Não foi possível carregar esta categoria."); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, attempt]);
  return (
    <View style={styles.section}>
      <AppText variant="label" accessibilityRole="header">{ALDUS_CATEGORIES[category]}</AppText>
      {error ? <View style={styles.inline}><AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>{error}</AppText><Button label="Tentar de novo" variant="ghost" onPress={() => setAttempt(value => value + 1)} /></View>
        : books === null ? <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">Carregando…</AppText>
        : books.length === 0 ? <AppText variant="caption" tone="secondary">Nada encontrado nesta categoria agora.</AppText>
        : <ShelfRow books={books} onOpen={onOpen} />}
    </View>
  );
}

function ShelfRow({ books, captions, onOpen }: { books: CatalogBook[]; captions?: string[]; onOpen: (book: CatalogBook) => void }) {
  const { palette } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {books.slice(0, 12).map((book, index) => (
        <Pressable key={book.id} accessibilityRole="button" accessibilityLabel={`${book.title}${book.authors[0] ? `, ${book.authors[0]}` : ""}${captions?.[index] ? `, porque você lê ${captions[index]}` : ""}`}
          onPress={() => onOpen(book)} android_ripple={{ color: palette.separator }} style={styles.card}>
          <View style={styles.cover}><BookCover identity={book.id} title={book.title} author={book.authors[0]} format="livro" source={book.coverUrl ? { uri: book.coverUrl } : null} compact /></View>
          <AppText variant="caption" numberOfLines={2}>{book.title}</AppText>
          {captions?.[index] ? <AppText variant="caption" tone="accent" numberOfLines={1}>{captions[index]}</AppText> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 22, marginTop: 8 },
  section: { gap: 8 },
  row: { gap: 12, paddingRight: 8 },
  card: { width: 96, gap: 4 },
  cover: { width: 96, height: 144, borderRadius: 4, overflow: "hidden" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
});
