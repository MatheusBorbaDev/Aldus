import { Flashcard, FlashcardReviewEvent } from "@/src/domain/types/flashcards";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReviewWeek {
  /** Início da janela (inclusive) em ms; janelas móveis de 7 dias terminando em `now`. */
  start: number;
  reviewed: number;
  correct: number;
}
export interface MissedCard { card: Flashcard; wrong: number; total: number }
export interface ReviewHistory { weeks: ReviewWeek[]; missed: MissedCard[]; total: number }

/** Nota da revisão: 3 e 4 são acerto (com pouca/muita confiança); 1 e 2, erro (ver `answerStudy`). */
export const isCorrectRating = (rating: FlashcardReviewEvent["rating"]) => rating >= 3;

/**
 * Histórico medido a partir dos eventos de revisão gravados. Sem eventos → null (a tela não mostra nada, em vez de zeros).
 * Semanas: as últimas `weeks` janelas de 7 dias, da mais antiga para a atual. "Mais errados": flashcards ainda existentes com pelo
 * menos 2 erros, ordenados por erros e depois pela taxa de erro.
 */
export function reviewHistory(reviews: FlashcardReviewEvent[], cards: Flashcard[], now = Date.now(), weeks = 4, missedLimit = 3): ReviewHistory | null {
  if (!reviews.length) return null;
  const windows: ReviewWeek[] = Array.from({ length: weeks }, (_, i) => ({ start: now - (weeks - i) * WEEK_MS, reviewed: 0, correct: 0 }));
  const byCard = new Map<string, { wrong: number; total: number }>();
  for (const review of reviews) {
    const correct = isCorrectRating(review.rating);
    const age = now - review.reviewedAt;
    if (age >= 0 && age < weeks * WEEK_MS) {
      const week = windows[weeks - 1 - Math.floor(age / WEEK_MS)];
      week.reviewed++; if (correct) week.correct++;
    }
    const stats = byCard.get(review.cardId) ?? { wrong: 0, total: 0 };
    stats.total++; if (!correct) stats.wrong++;
    byCard.set(review.cardId, stats);
  }
  const known = new Map(cards.map(card => [card.id, card]));
  const missed = [...byCard].filter(([id, s]) => s.wrong >= 2 && known.has(id))
    .map(([id, s]) => ({ card: known.get(id)!, wrong: s.wrong, total: s.total }))
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total)
    .slice(0, missedLimit);
  return { weeks: windows, missed, total: reviews.length };
}
