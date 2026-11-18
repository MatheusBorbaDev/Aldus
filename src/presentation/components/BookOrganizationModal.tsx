import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { isRecordBook, LibraryBook } from "@/src/domain/entities/LibraryBook";
import { BookOrganization, readingStatuses, ReadingStatus } from "@/src/domain/types/libraryOrganization";
import { libraryOrganization } from "@/src/presentation/services/dependencies";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";

export const readingStatusLabels: Record<ReadingStatus, string> = { unread: "Não iniciado", reading: "Lendo", completed: "Concluído", interrupted: "Interrompido" };

export function BookOrganizationModal({ book, record, onClose, onSaved }: { book: LibraryBook; record?: BookOrganization; onClose: () => void; onSaved: () => Promise<void> }) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [favorite, setFavorite] = useState(record?.favorite ?? false);
  const [wantToRead, setWantToRead] = useState(record?.wantToRead === true);
  const [rating, setRating] = useState<number | null>(record?.rating ?? null), [review, setReview] = useState(record?.review ?? "");
  const [collections, setCollections] = useState(record?.collections.join(", ") ?? "");
  const [tags, setTags] = useState(record?.tags.join(", ") ?? "");
  const [series, setSeries] = useState(record?.series ?? "");
  const [volume, setVolume] = useState(record?.volume?.toString() ?? "");
  const [status, setStatus] = useState<ReadingStatus | null>(record?.readingStatus ?? null);
  const [cover, setCover] = useState(record?.coverImagePath ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (label: string, value: string, update: (value: string) => void, placeholder?: string) => <View style={styles.field}>
    <Text style={{ color: palette.text }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={update} placeholder={placeholder} placeholderTextColor={palette.secondaryText} style={[styles.input, { color: palette.text, borderColor: palette.separator }]} />
  </View>;
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const split = (text: string) => text.split(",").map(v => v.trim()).filter(Boolean);
      if (volume.trim() && !/^\d+(?:[.,]\d+)?$/.test(volume.trim())) throw new Error("Informe um volume positivo, como 1 ou 2,5.");
      // Starts from the saved record so fields this sheet does not show (rating, review, manual progress) are kept.
      await libraryOrganization.save({ ...(record ?? {}), bookId: book.id, title: title.trim(), author: author.trim(), favorite, wantToRead: wantToRead ? true : undefined, rating: rating ?? undefined, review: review.trim() || undefined, collections: split(collections), tags: split(tags), series: series.trim(), volume: volume.trim() ? Number(volume.replace(",", ".")) : null, readingStatus: status,
        coverImagePath: cover.trim() ? cover.trim() : undefined, updatedAt: Date.now(), revision: (record?.revision ?? 0) + 1 });
      await onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar. Tente novamente."); }
    finally { setSaving(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.panel, { backgroundColor: palette.panel }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: palette.text }]}>Organizar livro</Text>
          {field("Título", title, setTitle)}{field("Autor", author, setAuthor)}
          <View style={styles.row}><Text style={{ color: palette.text }}>Favorito</Text><Switch accessibilityLabel="Favorito" value={favorite} onValueChange={setFavorite} /></View>
          <View style={styles.row}><Text style={{ color: palette.text }}>Quero ler</Text><Switch accessibilityLabel="Quero ler" value={wantToRead} onValueChange={setWantToRead} /></View>
          {field("Coleções", collections, setCollections, "Separadas por vírgula")}
          {field("Tags", tags, setTags, "Separadas por vírgula")}
          {field("Série", series, setSeries)}{field("Volume na série", volume, setVolume)}
          {field("Capa (URL HTTP/HTTPS)", cover, setCover, "Vazio para usar a capa original")}
          <Text style={{ color: palette.text }}>Estado de leitura</Text>
          <View style={styles.options}>{([null, ...readingStatuses] as const).map(value => <Pressable key={value ?? "auto"} accessibilityRole="radio" accessibilityState={{ checked: status === value }} onPress={() => setStatus(value)} style={[styles.choice, { borderColor: status === value ? palette.accent : palette.separator }]}><Text style={{ color: palette.text }}>{value ? readingStatusLabels[value] : "Automático pelo progresso"}</Text></Pressable>)}</View>
          <View style={styles.link}>
            <Text style={{ color: palette.text }}>Sua nota (só você vê)</Text>
            <View accessibilityRole="radiogroup" style={styles.stars}>{[1, 2, 3, 4, 5].map(value => (
              <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Nota ${value} de 5`} accessibilityState={{ checked: rating === value }} accessibilityHint={rating === value ? "Toque de novo para tirar a nota" : undefined}
                onPress={() => setRating(current => current === value ? null : value)} style={styles.star}>
                <Text style={{ color: rating !== null && value <= rating ? palette.accent : palette.secondaryText, fontSize: 28 }}>{rating !== null && value <= rating ? "★" : "☆"}</Text>
              </Pressable>))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={{ color: palette.text }}>Sua resenha (só você vê)</Text>
            <TextInput accessibilityLabel="Sua resenha (só você vê)" value={review} onChangeText={setReview} placeholder="Opcional" placeholderTextColor={palette.secondaryText} multiline maxLength={20000}
              style={[styles.input, { color: palette.text, borderColor: palette.separator, minHeight: 96, textAlignVertical: "top" }]} />
          </View>
          {!isRecordBook(book) ? <View style={styles.link}>
            {book.catalogId ? <Text style={{ color: palette.secondaryText }}>Ligado ao catálogo: as informações e as recomendações usam este livro.</Text> : null}
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { onClose(); router.push({ pathname: "/catalog", params: { link: book.id, q: title.trim() || book.title } } as never); }} style={[styles.choice, { borderColor: palette.separator, alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }]}>
              <Text style={{ color: palette.text }}>{book.catalogId ? "Trocar a ligação ao catálogo" : "Ligar ao catálogo"}</Text>
            </Pressable>
          </View> : null}
          <Text style={{ color: palette.secondaryText }}>Alterar o estado não modifica sua posição, arquivo ou anotações. Coleções e tags organizam os livros sem criar cópias.</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: palette.accent }}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.actions}><Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={styles.action}><Text style={{ color: palette.text }}>Cancelar</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.action, { backgroundColor: palette.accent }]}><Text style={{ color: "white" }}>{saving ? "Salvando…" : "Salvar organização"}</Text></Pressable></View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ link: { gap: 8 }, stars: { flexDirection: "row", gap: 4 }, star: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.5)", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }, panel: { width: "100%", maxWidth: 560, maxHeight: "100%", borderRadius: 12 }, content: { padding: 20, gap: 14 }, heading: { fontSize: 22, fontWeight: "700" }, field: { gap: 6 }, input: { borderWidth: 1, borderRadius: 6, padding: 10, minHeight: 44 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { padding: 10, borderWidth: 1, borderRadius: 6 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, padding: 16 }, action: { padding: 12, borderRadius: 6 } });
