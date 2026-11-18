import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { CatalogScreen } from "@/src/presentation/screens/CatalogScreen";

/** Catálogo de livros só com metadados (fase 2, 18/11/2026). */
export default function CatalogRoute() {
  return <AuthGuard><CatalogScreen /></AuthGuard>;
}
