import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { AllAnnotationsScreen } from "@/src/presentation/screens/AllAnnotationsScreen";

/** Todas as anotações (FASE 3, A2). */
export default function AnnotationsRoute() {
  return <AuthGuard><AllAnnotationsScreen /></AuthGuard>;
}
