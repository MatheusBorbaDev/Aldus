import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { GoodreadsImportScreen } from "@/src/presentation/screens/GoodreadsImportScreen";

/** Importar a estante do Goodreads por CSV, com revisão (18/11/2026). */
export default function GoodreadsImportRoute() {
  return <AuthGuard><GoodreadsImportScreen /></AuthGuard>;
}
