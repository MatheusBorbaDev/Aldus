import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppText, Button } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { appDependencies, libraryOrganization } from "@/src/presentation/services/dependencies";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { dismissLink, linkFileToRecord, readDismissedLinks } from "@/src/data/catalog/catalogLinking";
import { pendingCatalogLinks } from "@/src/domain/catalog/catalogLink";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { readableBookTitle } from "@/src/presentation/services/bookDisplay";

/**
 * Pergunta na Biblioteca quando um arquivo combina com um livro guardado sem arquivo (A5, 18/11/2026). Uma pergunta por vez; "Manter
 * separados" não pergunta de novo sobre o mesmo par neste aparelho. Nada é juntado sem o toque da pessoa.
 */
export function CatalogLinkPrompt({ books, onDone }: { books: LibraryBook[]; onDone: (message: string) => void }) {
  const { palette } = useAppTheme();
  const [dismissed, setDismissed] = useState<Set<string> | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    readDismissedLinks(AsyncStorage, libraryAccountScope.capture().userId).then(value => { if (alive) setDismissed(value); });
    return () => { alive = false; };
  }, []);
  if (!dismissed) return null;
  const pair = pendingCatalogLinks(books, dismissed)[0];
  if (!pair) return null;
  const title = readableBookTitle(pair.record);
  const join = async () => {
    setBusy(true); setError(null);
    try {
      await linkFileToRecord({ books: appDependencies.bookRepository, organization: libraryOrganization }, pair.file.id, pair.record.id);
      onDone(`Juntamos “${title}”: o arquivo agora tem o estado de leitura, as coleções e as informações do catálogo.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível juntar agora."); }
    finally { setBusy(false); }
  };
  const keepApart = async () => {
    const userId = libraryAccountScope.capture().userId;
    setDismissed(new Set([...dismissed, `${pair.file.id}|${pair.record.id}`]));
    if (userId) await dismissLink(AsyncStorage, userId, pair.file.id, pair.record.id).catch(() => undefined);
  };
  return (
    <View accessibilityRole="summary" style={[styles.card, { backgroundColor: palette.surfaceSecondary, borderColor: palette.border }]}>
      <AppText variant="label">Este arquivo é “{title}”?</AppText>
      <AppText variant="bodySmall" tone="secondary">Você guardou “{title}” sem arquivo. Juntar leva o estado de leitura, as coleções e as informações do catálogo para o arquivo, e o livro sem arquivo sai da estante.</AppText>
      {error ? <AppText variant="bodySmall" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      <View style={styles.actions}>
        <Button label="Juntar" variant="primary" onPress={() => void join()} disabled={busy} loading={busy} />
        <Button label="Manter separados" variant="ghost" onPress={() => void keepApart()} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
