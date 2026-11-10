import { Pressable, Text, View } from "react-native";
import { Flashcard, FlashcardEvaluation } from "@/src/domain/types/flashcards";
import { AppThemePalette } from "@/src/theme/tokens";
import { FlashcardCardView } from "./FlashcardCardView";
import { FlashcardConfidenceControls } from "./FlashcardConfidenceControls";
import { FlashcardFlip } from "./FlashcardFlip";

export function FlashcardSessionView({
  card,
  answer,
  index,
  total,
  score,
  busy,
  onAnswer,
  onNext,
  palette,
}: {
  card: Flashcard;
  answer: FlashcardEvaluation | null;
  index: number;
  total: number;
  score: number;
  busy: boolean;
  onAnswer: (choice: FlashcardEvaluation["choice"]) => void;
  onNext: () => void;
  palette: AppThemePalette;
}) {
  return (
    <View style={{ flex: 1, gap: 12, paddingBottom: 16 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: palette.secondaryText }}>
            Flashcard {index} de {total}
          </Text>
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            {score} pontos
          </Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel="Progresso da sessão" accessibilityValue={{ min: 0, max: total, now: index }} style={{ height: 4, borderRadius: 2, backgroundColor: palette.surfaceSecondary, overflow: "hidden" }}>
          <View style={{ height: 4, width: `${Math.round((index / Math.max(1, total)) * 100)}%`, backgroundColor: palette.accent }} />
        </View>
      </View>
      <FlashcardFlip revealed={!!answer}>
        <FlashcardCardView
          card={card}
          isFlipped={!!answer}
          evaluation={answer}
          palette={palette}
        />
      </FlashcardFlip>
      {answer ? (
        <Pressable
          disabled={busy}
          accessibilityRole="button"
          onPress={onNext}
          style={{
            minHeight: 52,
            padding: 16,
            borderRadius: 14,
            backgroundColor: palette.accent,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text
            style={{ color: palette.onAccent ?? palette.background, fontWeight: "700", textAlign: "center" }}
          >
            {busy
              ? "Salvando…"
              : index === total
                ? "Concluir e ver resultado"
                : "Próximo flashcard"}
          </Text>
        </Pressable>
      ) : (
        <FlashcardConfidenceControls
          onSelect={onAnswer}
          disabled={busy}
          palette={palette}
        />
      )}
    </View>
  );
}
