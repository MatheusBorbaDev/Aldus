import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AppText, Button, Chip, ChipRow, EmptyState, Screen, ScreenHeader, Section } from "@/src/ui";
import { vestibularReadings } from "@/src/data/study/vestibularDependencies";
import { VestibularReadResult, VestibularSuggestionError } from "@/src/data/study/VestibularReadingsService";
import { VestibularReadingList, vestibularReadingsView, SUGGESTION_MAX } from "@/src/domain/study/vestibularReadings";
import { VestibularBookPanel } from "@/src/presentation/components/study/VestibularBookPanel";

/**
 * Leituras de vestibular (25/11/2026, pedido do dono): escolher o vestibular, ver primeiro a lista da prova que vem pela frente e,
 * embaixo, as listas já usadas. Toda lista mostra a fonte oficial. Visível para todas as contas, com ou sem flashcards.
 */
export default function VestibularRoute() {
  return <AuthGuard><VestibularScreen /></AuthGuard>;
}

function VestibularScreen() {
  const { palette } = useAppTheme();
  const [result, setResult] = useState<VestibularReadResult | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [openPast, setOpenPast] = useState<number | null>(null);
  const load = useCallback(async () => {
    const [read, choice] = await Promise.all([vestibularReadings.read(), vestibularReadings.readChoice()]);
    setResult(read);
    const ids = read.snapshot?.vestibulares.map(v => v.id) ?? [];
    setChosen(current => current && ids.includes(current) ? current : choice && ids.includes(choice) ? choice : ids[0] ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const snapshot = result?.snapshot ?? null;
  const vestibular = snapshot?.vestibulares.find(v => v.id === chosen) ?? null;
  const view = useMemo(() => snapshot && chosen ? vestibularReadingsView(snapshot.lists, chosen, new Date()) : null, [snapshot, chosen]);
  const choose = (id: string) => { setChosen(id); setOpenPast(null); void vestibularReadings.saveChoice(id); };

  return (
    <Screen header={<ScreenHeader back fallbackHref="/study" title="Leituras de vestibular" subtitle="As obras que cada vestibular pede, com o edital de onde saíram." />}>
      {result === null ? <AppText tone="secondary">Carregando…</AppText> : null}
      {result?.source === "unavailable" ? (
        <EmptyState icon="cloud-offline-outline" title="Listas indisponíveis" description="Não foi possível buscar as listas e não há cópia neste aparelho. Confira a internet e tente de novo." />
      ) : null}
      {result?.source === "unavailable" ? <Button label="Tentar de novo" icon="refresh" onPress={() => { setResult(null); void load(); }} /> : null}
      {result?.source === "copy" && snapshot ? (
        <AppText variant="bodySmall" tone="secondary" accessibilityRole="alert">Sem conexão: mostrando a cópia salva em {new Date(snapshot.savedAt).toLocaleDateString("pt-BR")}.</AppText>
      ) : null}

      {snapshot?.vestibulares.length ? (
        <ChipRow label="Escolha o vestibular">
          {snapshot.vestibulares.map(v => <Chip key={v.id} label={v.name} selected={v.id === chosen} onPress={() => choose(v.id)} accessibilityHint={v.institution} />)}
        </ChipRow>
      ) : null}

      {vestibular && view ? (
        <>
          <AppText variant="bodySmall" tone="secondary">{vestibular.institution}</AppText>
          <Section title={`Próximas provas`}>
            {view.targetPending ? (
              <View style={[styles.notice, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <AppText variant="bodySmall">A lista do {vestibular.name} {view.targetYear} ainda não foi publicada. Quando o edital sair, ela aparece aqui.</AppText>
              </View>
            ) : null}
            {view.upcoming.map(list => <ReadingList key={list.examYear} list={list} title={`${vestibular.name} ${list.examYear}`} />)}
          </Section>
          {view.past.length ? (
            <Section title="Listas já usadas">
              {view.past.map(list => (
                <View key={list.examYear}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: openPast === list.examYear }} onPress={() => setOpenPast(openPast === list.examYear ? null : list.examYear)}
                    style={[styles.pastRow, { borderColor: palette.border }]}>
                    <AppText variant="body">{vestibular.name} {list.examYear}</AppText>
                    <AppText variant="bodySmall" tone="secondary">{list.books.length} {list.books.length === 1 ? "obra" : "obras"} · {openPast === list.examYear ? "fechar" : "ver"}</AppText>
                  </Pressable>
                  {openPast === list.examYear ? <ReadingList list={list} /> : null}
                </View>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}

      {snapshot ? <SuggestionBox vestibularId={chosen} /> : null}
    </Screen>
  );
}

function ReadingList({ list, title }: { list: VestibularReadingList; title?: string }) {
  const { palette } = useAppTheme();
  // 25/11/2026: tocar numa obra abre, aqui mesmo, o arquivo gratuito em domínio público (quando houver) e a ficha do catálogo.
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={[styles.list, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      {title ? <AppText variant="title">{title}</AppText> : null}
      {list.books.map(book => (
        <View key={`${book.position}-${book.title}`}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === book.position }} accessibilityLabel={`${book.title}, de ${book.author}. Ver se há arquivo em domínio público`}
          onPress={() => setOpen(open === book.position ? null : book.position)} style={styles.book}>
          <AppText variant="bodySmall" tone="secondary" style={styles.position}>{book.position}.</AppText>
          <View style={{ flex: 1 }}>
            <AppText variant="body">{book.title}</AppText>
            <AppText variant="bodySmall" tone="secondary">{book.author}{book.note ? ` · ${book.note}` : ""}</AppText>
          </View>
        </Pressable>
        {open === book.position ? <VestibularBookPanel book={book} /> : null}
        </View>
      ))}
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(list.sourceUrl)} style={styles.source}>
        <AppText variant="bodySmall" tone="accent">Fonte: edital oficial</AppText>
      </Pressable>
    </View>
  );
}

function SuggestionBox({ vestibularId }: { vestibularId: string | null }) {
  const { palette } = useAppTheme();
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async () => {
    setBusy(true); setMessage(null);
    try { await vestibularReadings.suggest({ vestibularId, message: text }); setText(""); setMessage({ ok: true, text: "Obrigado! A sugestão foi enviada para conferência." }); }
    catch (error) { setMessage({ ok: false, text: error instanceof VestibularSuggestionError ? error.message : "Não foi possível enviar a sugestão." }); }
    finally { setBusy(false); }
  };
  return (
    <Section title="Sugestões">
      <AppText variant="bodySmall" tone="secondary">Faltou um vestibular ou uma obra está errada? Conte para nós. Toda sugestão é conferida no edital antes de entrar.</AppText>
      {open ? (
        <>
          <TextInput accessibilityLabel="Sua sugestão" multiline maxLength={SUGGESTION_MAX} value={text} onChangeText={setText}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.input ?? palette.surface }]} />
          <AppText variant="caption" tone="secondary">{text.trim().length}/{SUGGESTION_MAX}</AppText>
          <Button label={busy ? "Enviando…" : "Enviar sugestão"} icon="send" variant="primary" disabled={busy} onPress={() => void send()} />
        </>
      ) : <Button label="Sugerir" icon="chatbubble-ellipses-outline" onPress={() => setOpen(true)} />}
      {message ? <AppText variant="bodySmall" tone={message.ok ? "success" : "danger"} accessibilityRole="alert">{message.text}</AppText> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: 12, padding: 14 },
  list: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  book: { flexDirection: "row", gap: 10, paddingVertical: 8, minHeight: 44 },
  position: { minWidth: 22 },
  source: { minHeight: 44, justifyContent: "center" },
  pastRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 48, borderBottomWidth: 1, gap: 12 },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 96, padding: 12, textAlignVertical: "top" },
});
