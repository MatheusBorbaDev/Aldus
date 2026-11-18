import { betaLimitationsDocument } from "@/src/legal/betaLimitations";
import { LegalDocumentScreen } from "@/src/presentation/components/legal/LegalDocumentScreen";

/** "O que esperar desta beta" (aprovado em 18/11/2026), aberto pelo aviso de novidades e por Ajustes. */
export default function BetaScreen() {
  return <LegalDocumentScreen document={betaLimitationsDocument} showReviewStatus={false} />;
}
