import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  useAuth,
  useFeatureAccess,
} from "@/src/presentation/contexts/AuthContext";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { FeatureDenied } from "@/src/presentation/components/FeatureDenied";
import { flashcardsForUser } from "@/src/data/local/FlashcardRepository";
import {
  Flashcard,
  FlashcardSnapshot,
  isPlayableFlashcard,
} from "@/src/domain/types/flashcards";
import { dueCards } from "@/src/domain/study/flashcardSrs";
import { FlashcardCreateModal } from "@/src/presentation/components/flashcards/FlashcardCreateModal";
import { AppText, Button, EmptyState, radius, Screen, ScreenHeader, space, touchTarget, typography } from "@/src/ui";

export default function Deck() {
  const { allowed } = useFeatureAccess("flashcards");
  return <AuthGuard>{allowed ? <DeckContent /> : <FeatureDenied />}</AuthGuard>;
}

/** Um deck (redesenho, etapa 5): "Estudar" é a ação principal; a lista mostra o que falta completar em cada flashcard. */
function DeckContent() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { user, canUse } = useAuth();
  const { palette } = useAppTheme();
  const repository = useMemo(() => flashcardsForUser(user!.id), [user?.id]);
  const [snapshot, setSnapshot] = useState<FlashcardSnapshot | null>(null),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [card, setCard] = useState<Flashcard | null>(null),
    [name, setName] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void repository
        .load()
        .then((s) => {
          if (active) setSnapshot(s);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      return () => {
        active = false;
      };
    }, [repository]),
  );
  const deck = snapshot?.decks.find((d) => d.id === deckId),
    cards = snapshot?.cards.filter((c) => c.deckId === deckId) ?? [];
  const playable = cards.filter(isPlayableFlashcard), due = dueCards(playable).length;
  const save = async (value: Flashcard) => {
    if (!canUse("flashcards")) throw new Error("Flashcards indisponíveis.");
    if (card) await repository.updateCard(value);
    else await repository.createCards([value]);
    try {
      setSnapshot(await repository.load());
    } catch {
      setError("Flashcard salvo. Reabra o deck para atualizar a lista.");
    }
  };
  const saveName = () => {
    if (!deck || !name?.trim() || busy) return;
    setBusy(true);
    void repository
      .updateDeck({ ...deck, title: name.trim(), updatedAt: Date.now() })
      .then(() => repository.load())
      .then((s) => {
        setSnapshot(s);
        setName(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  const openCard = (value: Flashcard | null) => { setCard(value); setEditing(true); };
  const subtitle = deck
    ? `${cards.length} ${cards.length === 1 ? "flashcard" : "flashcards"} · ${playable.length} ${playable.length === 1 ? "pronto" : "prontos"}${due ? ` · ${due} para revisar` : ""}`
    : undefined;
  return (
    <Screen header={<ScreenHeader title={deck?.title ?? "Deck"} subtitle={subtitle} back backLabel="Voltar aos decks" fallbackHref="/study" />}>
      {error ? <AppText variant="bodySmall" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      {!snapshot && !error ? (
        <View accessibilityLabel="Carregando deck" style={styles.loading}><ActivityIndicator color={palette.accent} /></View>
      ) : snapshot && !deck ? (
        <EmptyState icon="albums-outline" title="Deck não encontrado." description="Ele pode ter sido removido neste dispositivo.">
          <Button label="Voltar aos decks" onPress={() => router.replace("/study" as never)} />
        </EmptyState>
      ) : deck ? (
        <>
          <View style={styles.actions}>
            <Button label="Estudar" icon="play" variant="primary" disabled={!playable.length} accessibilityHint={playable.length ? undefined : "Complete ao menos um flashcard para estudar"} onPress={() => router.push(`/study/${deck.id}` as never)} />
            <Button label="Criar flashcard" icon="add" onPress={() => openCard(null)} />
            <Button label="Usar na batalha" icon="people-outline" variant="ghost" onPress={() => router.push({ pathname: "/battle", params: { deckId: deck.id } } as never)} />
            {name === null ? <Button label="Editar deck" icon="create-outline" variant="ghost" onPress={() => setName(deck.title)} /> : null}
          </View>
          {name !== null ? (
            <View style={[styles.rename, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <AppText variant="label">Nome do deck</AppText>
              <TextInput
                accessibilityLabel="Nome do deck"
                value={name}
                onChangeText={setName}
                onSubmitEditing={saveName}
                autoFocus
                style={[styles.input, typography.body, { color: palette.text, backgroundColor: palette.input, borderColor: palette.border }]}
              />
              <View style={styles.actions}>
                <Button label="Salvar nome" variant="primary" disabled={busy || !name.trim()} loading={busy} onPress={saveName} />
                <Button label="Cancelar" accessibilityLabel="Cancelar edição do deck" variant="ghost" disabled={busy} onPress={() => setName(null)} />
              </View>
            </View>
          ) : null}
          {!playable.length && cards.length ? <AppText variant="bodySmall" tone="secondary">Nenhum flashcard está pronto para estudar. Abra um deles e complete os campos e o gabarito.</AppText> : null}
          {cards.length ? (
            <View style={styles.cards}>
              {cards.map((c) => {
                const ready = isPlayableFlashcard(c);
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.title || "Flashcard sem título"}. ${ready ? "Pronto. Toque para editar" : "Incompleto. Toque para completar campos e gabarito"}`}
                    onPress={() => openCard(c)}
                    android_ripple={{ color: palette.separator }}
                    style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <View style={styles.cardHead}>
                      <AppText variant="label" numberOfLines={2} style={styles.cardTitle}>{c.title || "Flashcard sem título"}</AppText>
                      <AppText variant="caption" tone={ready ? "success" : "accent"}>{ready ? "✓ Pronto" : "Completar"}</AppText>
                    </View>
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={3}>{c.statement || c.front}</AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyState icon="create-outline" title="Este deck ainda não tem flashcards" description="Crie o primeiro para começar a estudar.">
              <Button label="Criar flashcard" icon="add" variant="primary" onPress={() => openCard(null)} />
            </EmptyState>
          )}
          <FlashcardCreateModal
            visible={editing}
            decks={snapshot!.decks}
            initialDeckId={deck.id}
            initialCard={card}
            onClose={() => setEditing(false)}
            onSave={save}
            palette={palette}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: space.section, alignItems: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  rename: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  input: { minHeight: touchTarget + 4, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  cards: { gap: space.sm },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  cardTitle: { flex: 1, minWidth: 0 },
});
