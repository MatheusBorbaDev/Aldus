import { AuthGuard } from "@/src/presentation/components/AuthGuard";
import { CatalogScreen } from "@/src/presentation/screens/CatalogScreen";

/**
 * Aba Descobrir (19/11/2026, dono: "troca essa aba descobrir pelo catalogo estilo netflix com os metadados, o randomizer de
 * indicação e remove esses negocios de gutendex biblion e mec livros"): vitrine do catálogo, Sortear um livro e Suas fontes.
 * O nome de rota `search` é preservado por compatibilidade de links.
 */
export default function Discover() {
  return <AuthGuard><CatalogScreen tab /></AuthGuard>;
}
