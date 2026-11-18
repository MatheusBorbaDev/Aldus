import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Share, StyleSheet, Switch, View } from "react-native";
import { AppText, Button, EmptyState, Screen, ScreenHeader } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { useReaderSettings } from "@/src/presentation/contexts/ReaderSettingsContext";
import { appDependencies, libraryOrganization } from "@/src/presentation/services/dependencies";
import { readableBookTitle } from "@/src/presentation/services/bookDisplay";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { buildDiary, DiaryDay, diaryDayLabel, formatActiveTime, localDayKey } from "@/src/domain/reader/readingDiary";
import { goodreadsCsv } from "@/src/domain/library/goodreadsCsv";
import { inferredReadingStatus } from "@/src/domain/types/libraryOrganization";

/**
 * Diário de leitura (FASE 3, B1) e exportação CSV no padrão Goodreads (B2). Só sessões medidas neste aparelho, na conta aberta;
 * os minutos seguem "Ocultar porcentagem e páginas". Sem sequência de dias, metas diárias, ranking ou comparação.
 */
export function ReadingDiaryScreen() {
  const { palette } = useAppTheme();
  const settings = useReaderSettings();
  const [days, setDays] = useState<DiaryDay[] | null>(null);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const run = useRef(0);
  const showTime = !settings.hideReadingCounts;

  const load = useCallback(async () => {
    const current = ++run.current, account = libraryAccountScope.capture();
    setError(null);
    if (!account.userId) { setDays([]); return; }
    try {
      const [sessions, books] = await Promise.all([appDependencies.readingSessions.list(account.userId), appDependencies.bookRepository.listActive()]);
      account.check();
      if (run.current === current) setDays(buildDiary(sessions, new Map(books.map(book => [book.id, readableBookTitle(book)]))));
    } catch (failure) {
      if (run.current === current) setError(failure instanceof Error ? failure.message : "Não foi possível ler o diário.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const account = libraryAccountScope.capture();
      const [books, records] = await Promise.all([appDependencies.bookRepository.listActive(), libraryOrganization.list()]);
      account.check();
      const csv = goodreadsCsv(books.filter(book => !book.isDeleted).map(book => ({
        title: readableBookTitle(book), author: book.author || null, addedDate: book.addedDate ?? null,
        status: inferredReadingStatus(book, records[book.id]), collections: records[book.id]?.collections ?? [],
        rating: records[book.id]?.rating ?? null, review: records[book.id]?.review ?? null,
      })));
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "aldus-biblioteca-goodreads.csv"; link.click(); URL.revokeObjectURL(url);
      } else await Share.share({ title: "Biblioteca para o Goodreads (CSV)", message: csv });
      setNotice("Lista da biblioteca exportada. Só título, autor, data de entrada, situação, coleções e sua nota e resenha, se houver; nenhum arquivo de livro.");
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : "Não foi possível exportar.");
    } finally { setBusy(false); }
  };

  const today = localDayKey(Date.now()), yesterday = localDayKey(Date.now() - 24 * 60 * 60 * 1000);
  return (
    <Screen header={<ScreenHeader title="Diário de leitura" subtitle="Sessões medidas neste aparelho" back />}>
      <View style={styles.row}>
        <AppText style={{ flex: 1 }}>Mostrar minutos de leitura</AppText>
        <Switch accessibilityLabel="Mostrar minutos de leitura" value={showTime} onValueChange={value => settings.setHideReadingCounts(!value)}
          thumbColor={showTime ? palette.accent : palette.surface} trackColor={{ false: palette.border, true: palette.accent }} />
      </View>
      <AppText variant="caption" tone="secondary">Conta só tempo de leitura ativa, desde que o diário existe. Fica neste aparelho e não é comparado com ninguém.</AppText>
      {error ? <EmptyState icon="alert-circle-outline" title="Não foi possível ler o diário" description={error} /> : null}
      {!error && days === null ? <AppText tone="secondary">Carregando diário…</AppText> : null}
      {days && days.length === 0 ? <EmptyState icon="calendar-outline" title="Nenhuma sessão registrada" description="As sessões aparecem aqui depois que você lê um livro neste aparelho." /> : null}
      {days?.map(day => (
        <View key={day.day} style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
          <AppText variant="title">{diaryDayLabel(day.day, today, yesterday)}{showTime ? ` · ${formatActiveTime(day.seconds)}` : ""}</AppText>
          {day.books.map(entry => <AppText key={entry.bookId} tone="secondary">{entry.title}{showTime ? ` · ${formatActiveTime(entry.seconds)}` : ""}</AppText>)}
        </View>
      ))}
      <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <AppText variant="title">Levar a biblioteca para o Goodreads</AppText>
        <AppText tone="secondary">Gera um CSV no formato de importação do Goodreads com título, autor, data de entrada, situação e coleções. ISBN, notas e datas de conclusão ficam vazios: o Aldus não os registra.</AppText>
        <Button label="Exportar CSV (Goodreads)" icon="download-outline" variant="secondary" disabled={busy} onPress={() => void exportCsv()} />
        {notice ? <AppText accessibilityLiveRegion="polite">{notice}</AppText> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 6 },
});
