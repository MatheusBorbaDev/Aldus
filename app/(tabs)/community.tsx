import { CommunityProvider } from "@/src/community/presentation/CommunityProvider";
import { CommunityHomeScreen } from "@/src/community/presentation/CommunityHomeScreen";

/** Aba Comunidade (pedido do dono em 16/11/2026): a rede social fica a um toque, com Pessoas no topo. */
export default function CommunityTab() {
  return <CommunityProvider><CommunityHomeScreen asTab /></CommunityProvider>;
}
