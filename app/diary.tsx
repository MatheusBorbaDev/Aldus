import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { ReadingDiaryScreen } from "@/src/presentation/screens/ReadingDiaryScreen";

/** Diário de leitura e CSV Goodreads (FASE 3, B1 e B2). */
export default function DiaryRoute() {
  return <AuthGuard><ReadingDiaryScreen /></AuthGuard>;
}
