import { useEffect, useMemo, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Chip, Screen, ScreenHeader } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { appDependencies, libraryOrganization } from "@/src/presentation/services/dependencies";
import { importGoodreadsCandidates } from "@/src/data/catalog/goodreadsImporter";
import { GOODREADS_MAX_BYTES, GoodreadsCandidate, parseGoodreadsCsv } from "@/src/domain/library/goodreadsImport";
import { RECORD_FORMAT_LABELS, RecordBookFormat } from "@/src/domain/catalog/recordBook";
import { newLibraryId } from "@/src/domain/entities/libraryId";

const START_LABELS: Record<GoodreadsCandidate["start"], string> = { want: "Quero ler", reading: "Lendo", completed: "Lido", interrupted: "Interrompido" };

/**
 * Importar a estante do Goodreads (18/11/2026): escolher o CSV exportado, revisar livro a livro e só então gravar. O arquivo é lido
 * neste aparelho e não é enviado a ninguém; entram livros sem arquivo, nunca arquivos de livros.
 */
export function GoodreadsImportScreen() {
  const { palette } = useAppTheme();
  const [candidates, setCandidates] = useState<GoodreadsCandidate[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<RecordBookFormat>("physical");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0), [finished, setFinished] = useState<number | null>(null);

  useEffect(() => { if (candidates) setChosen(new Set(candidates.filter(item => !item.inLibrary).map(item => item.key))); }, [candidates]);
  const selected = useMemo(() => (candidates ?? []).filter(item => chosen.has(item.key)), [candidates, chosen]);

  const pick = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/*", "application/csv", "application/vnd.ms-excel", "text/comma-separated-values"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > GOODREADS_MAX_BYTES) throw new Error("O arquivo passa de 5 MB.");
      setBusy(true);
      const text = Platform.OS === "web" ? await (asset.file ?? await (await fetch(asset.uri)).blob()).text() : await FileSystem.readAsStringAsync(asset.uri);
      const library = await appDependencies.bookRepository.listActive();
      const found = parseGoodreadsCsv(text, library);
      if (!found.length) throw new Error("Nenhum livro encontrado neste arquivo.");
      setFinished(null); setCandidates(found);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível ler o arquivo."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!selected.length || busy) return;
    setBusy(true); setError(null); setProgress(0);
    try {
      const count = await importGoodreadsCandidates({ books: appDependencies.bookRepository, organization: libraryOrganization, newId: newLibraryId }, selected, format, setProgress);
      setFinished(count); setCandidates(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível gravar."); }
    finally { setBusy(false); }
  };

  const toggle = (key: string) => setChosen(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  return (
    <Screen scroll={!candidates} header={<ScreenHeader title="Importar do Goodreads" subtitle="Sua estante em CSV, revisada antes de entrar. Nenhum arquivo de livro." back />}>
      {!candidates ? <View style={styles.intro}>
        <AppText variant="body">No Goodreads, abra My Books → Import and export → Export Library e baixe o arquivo CSV. Depois escolha esse arquivo aqui.</AppText>
        <AppText variant="bodySmall" tone="secondary">O arquivo é lido neste aparelho e não é enviado a ninguém. Entram título, autor, estante, sua nota, sua resenha e suas estantes extras como coleções. Os livros entram sem arquivo.</AppText>
        <Button label={busy ? "Lendo o arquivo…" : "Escolher arquivo CSV"} variant="primary" icon="document-text-outline" onPress={() => void pick()} disabled={busy} loading={busy} />
        {finished !== null ? <View style={[styles.notice, { backgroundColor: palette.surfaceSecondary }]}>
          <AppText variant="label" accessibilityRole="alert">{finished === 1 ? "1 livro entrou na sua estante." : `${finished} livros entraram na sua estante.`}</AppText>
          <Button label="Ir para a Biblioteca" variant="ghost" onPress={() => router.replace("/library" as never)} />
        </View> : null}
        {error ? <AppText variant="bodySmall" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      </View> : <FlatList
        data={candidates}
        keyExtractor={item => item.key}
        ListHeaderComponent={<View style={styles.head}>
          <AppText variant="label">Como você tem esses livros?</AppText>
          <View style={styles.chips}>{(Object.keys(RECORD_FORMAT_LABELS) as RecordBookFormat[]).map(value => <Chip key={value} label={RECORD_FORMAT_LABELS[value]} selected={format === value} onPress={() => setFormat(value)} />)}</View>
          <View style={styles.chips}>
            <Button label="Marcar todos" variant="ghost" onPress={() => setChosen(new Set(candidates.map(item => item.key)))} disabled={busy} />
            <Button label="Desmarcar todos" variant="ghost" onPress={() => setChosen(new Set())} disabled={busy} />
          </View>
          <AppText variant="caption" tone="secondary">Livros que já estão na sua biblioteca começam desmarcados.</AppText>
        </View>}
        renderItem={({ item }) => {
          const checked = chosen.has(item.key);
          return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} accessibilityLabel={`${item.title}${item.author ? `, ${item.author}` : ""}, ${START_LABELS[item.start]}${item.inLibrary ? ", já na sua biblioteca" : ""}`}
            disabled={busy} onPress={() => toggle(item.key)} style={[styles.row, { borderBottomColor: palette.separator }]}>
            <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? palette.accent : palette.secondaryText} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <AppText variant="label" numberOfLines={2}>{item.title}</AppText>
              <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>{[item.author || "Autor não informado", START_LABELS[item.start], item.rating ? "★".repeat(item.rating) : null].filter(Boolean).join(" · ")}</AppText>
              {item.inLibrary ? <AppText variant="caption" tone="accent">Já na sua biblioteca</AppText> : null}
            </View>
          </Pressable>;
        }}
        ListFooterComponent={<View style={styles.foot}>
          {error ? <AppText variant="bodySmall" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
          {busy ? <AppText variant="bodySmall" accessibilityLiveRegion="polite">Gravando {progress} de {selected.length}…</AppText> : null}
          <Button label={selected.length === 1 ? "Importar 1 livro" : `Importar ${selected.length} livros`} variant="primary" block onPress={() => void save()} disabled={!selected.length || busy} loading={busy} />
          <Button label="Escolher outro arquivo" variant="ghost" onPress={() => setCandidates(null)} disabled={busy} />
        </View>}
      />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 14 },
  head: { gap: 10, paddingBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  foot: { gap: 10, paddingVertical: 16 },
  notice: { borderRadius: 12, padding: 12, gap: 6 },
});
