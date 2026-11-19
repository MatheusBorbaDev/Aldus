import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, IconButton } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { BookCover } from "@/src/presentation/components/BookCover";
import { getBookCover } from "@/src/utils/coverHelper";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { calendarMonth, calendarMonthLabel, DiaryDay, diaryFullDayLabel } from "@/src/domain/reader/readingDiary";
import { readableBookTitle } from "@/src/presentation/services/bookDisplay";

const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * Calendário de leitura (19/11/2026): a capa do livro lido aparece no dia, como no Papel Amassado, mas privado e sem contadores
 * (sem dias seguidos, metas ou totais). Tocar num dia mostra só as sessões dele no diário abaixo.
 */
export function ReadingCalendar({ days, books, selected, onSelect, now = Date.now() }: {
  days: DiaryDay[]; books: Map<string, LibraryBook>; selected: string | null; onSelect: (day: string | null) => void; now?: number;
}) {
  const { palette } = useAppTheme();
  const today = new Date(now);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const weeks = useMemo(() => calendarMonth(cursor.year, cursor.month, days), [cursor, days]);
  const move = (delta: number) => setCursor(({ year, month }) => {
    const next = new Date(year, month + delta, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  });
  const titleOf = (id: string) => { const book = books.get(id); return book ? readableBookTitle(book) : "Livro removido da biblioteca"; };
  return (
    <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Mês anterior" onPress={() => move(-1)} />
        <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" style={{ flex: 1, textAlign: "center" }}>{calendarMonthLabel(cursor.year, cursor.month)}</AppText>
        <IconButton icon="chevron-forward" label="Próximo mês" onPress={() => move(1)} />
      </View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAY_INITIALS.map((initial, index) => <AppText key={index} variant="caption" tone="secondary" style={styles.weekday}>{initial}</AppText>)}
      </View>
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((cell, column) => {
            if (!cell.day) return <View key={column} style={styles.cell} />;
            const read = cell.bookIds.length > 0, first = read ? books.get(cell.bookIds[0]) : undefined, active = selected === cell.day;
            const label = `${WEEKDAY_NAMES[column]}, ${diaryFullDayLabel(cell.day)}${read ? `: leu ${cell.bookIds.map(titleOf).join(", ")}` : ", sem leitura registrada"}`;
            return (
              <Pressable key={column} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled: !read }} disabled={!read}
                onPress={() => onSelect(active ? null : cell.day)} style={[styles.cell, active && { borderColor: palette.accent, borderWidth: 2, borderRadius: 6 }]}>
                <AppText variant="caption" tone={read ? "default" : "secondary"}>{cell.date}</AppText>
                {read ? <View style={styles.cover}>
                  {first ? <BookCover identity={first.id} title={first.title} author={first.author} format={first.mimeType === "application/pdf" ? "pdf" : "epub"}
                    source={getBookCover({ id: first.id, title: first.title, author: first.author, format: first.mimeType === "application/pdf" ? "pdf" : "epub", coverUri: first.coverImagePath ?? undefined, fileUri: first.filePath, progress: first.progress })} compact />
                    : <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.accentSoft }]} />}
                </View> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <AppText variant="caption" tone="secondary">A capa aparece no dia em que você leu. Toque num dia para ver só as sessões dele.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, gap: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: 4 },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center" },
  cell: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 4, minHeight: 44, borderWidth: 2, borderColor: "transparent" },
  cover: { width: "70%", aspectRatio: 2 / 3, borderRadius: 3, overflow: "hidden" },
});
