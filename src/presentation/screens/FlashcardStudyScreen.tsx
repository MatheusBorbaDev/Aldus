import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/src/presentation/contexts/AuthContext";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { flashcardsForUser } from "@/src/data/local/FlashcardRepository";
import {
  FlashcardSnapshot,
  FlashcardStudySession,
  isPlayableFlashcard,
} from "@/src/domain/types/flashcards";
import { FLASHCARD_SCORING_DESCRIPTION } from "@/src/domain/study/flashcardScoring";
import { FlashcardSessionView } from "@/src/presentation/components/flashcards/FlashcardSessionView";
import { AppText, Button, radius, Screen, ScreenHeader, space } from "@/src/ui";

export function FlashcardStudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { user, canUse } = useAuth();
  const { palette } = useAppTheme();
  const repository = useMemo(() => flashcardsForUser(user!.id), [user?.id]);
  const [snapshot, setSnapshot] = useState<FlashcardSnapshot | null>(null),
    [session, setSession] = useState<FlashcardStudySession | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
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
  }, [repository, deckId]);
  const operate = async (job: () => Promise<FlashcardStudySession>) => {
    if (locked.current) return;
    if (!canUse("flashcards")) {
      setError("Flashcards indisponíveis para esta conta.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      setSession(await job());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Sua resposta não foi perdida; tente novamente.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const deck = snapshot?.decks.find((d) => d.id === deckId),
    saved = snapshot?.sessions?.find((s) => s.deckId === deckId);
  const card = session?.cards[session.index];
  const answer = session?.answers.find((a) => a.cardId === card?.id) ?? null;
  const playable = snapshot?.cards.filter((c) => c.deckId === deckId && isPlayableFlashcard(c)).length ?? 0;
  const start = (fresh = false) => void operate(() => repository.studySession(deckId, fresh || undefined));
  const correct = session?.answers.filter((a) => a.isCorrect).length ?? 0;
  // Durante as perguntas a tela não rola: o cartão ocupa a altura e os botões de resposta ficam sempre ao alcance.
  const answering = !!session && !session.completed && !!card;
  return (
    <Screen scroll={!answering} header={<ScreenHeader title={deck?.title ?? "Estudo"} back backLabel="Voltar" fallbackHref="/study" />}>
      {error ? <AppText variant="bodySmall" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      {!snapshot && !error ? (
        <View accessibilityLabel="Carregando estudo" style={styles.loading}><ActivityIndicator color={palette.accent} /></View>
      ) : !session ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <AppText variant="heading">Estudar flashcards</AppText>
          <AppText variant="bodySmall" tone="secondary">{FLASHCARD_SCORING_DESCRIPTION}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {playable} flashcards completos. A explicação aparece após responder. Você decide quando avançar.
          </AppText>
          {deck ? (
            <View style={styles.actions}>
              <Button label={saved ? (saved.completed ? "Ver último resumo" : "Retomar sessão") : "Iniciar estudo"} variant="primary" disabled={busy} onPress={() => start()} />
              {saved ? <Button label="Iniciar nova sessão" disabled={busy} onPress={() => start(true)} /> : null}
            </View>
          ) : (
            <AppText variant="body">Deck não encontrado.</AppText>
          )}
        </View>
      ) : session.completed ? (
        <>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <AppText variant="overline" tone="secondary">Sessão concluída</AppText>
            <AppText variant="display">{session.score} pontos</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {session.answers.length} respostas · {correct} acertos · {session.answers.length - correct} erros
            </AppText>
            <View style={styles.actions}>
              <Button label="Estudar novamente" variant="primary" disabled={busy} onPress={() => start(true)} />
              <Button label="Voltar ao deck" variant="ghost" onPress={() => router.back()} />
            </View>
          </View>
          {session.answers.map((a) => {
            const answered = session.cards.find((c) => c.id === a.cardId);
            return (
              <View key={a.cardId} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <AppText variant="label">{answered?.title}</AppText>
                <AppText variant="bodySmall" tone={a.isCorrect ? "success" : "danger"}>
                  {a.symbol} · {a.isCorrect ? "Acerto" : "Erro"} · {a.points > 0 ? "+" : ""}{a.points} pontos
                </AppText>
                <AppText variant="bodySmall" tone="secondary">{answered?.explanation}</AppText>
              </View>
            );
          })}
        </>
      ) : card ? (
        <FlashcardSessionView
          card={card}
          answer={answer}
          index={session.index + 1}
          total={session.cards.length}
          score={session.score}
          busy={busy}
          palette={palette}
          onAnswer={(choice) =>
            void operate(() =>
              repository.answerStudy(session.id, card.id, choice),
            )
          }
          onNext={() =>
            void operate(() => repository.advanceStudy(session.id, card.id))
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: space.section, alignItems: "center" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
});
