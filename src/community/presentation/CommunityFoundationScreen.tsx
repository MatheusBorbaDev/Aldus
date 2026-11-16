import { router, type Href } from "expo-router";
import { Action, Card, CommunityPage, Copy } from "./components";

/** Endereço desconhecido dentro da Comunidade. Clubes, Fóruns e Pessoas têm telas próprias (Etapas 2 e 3). */
export function CommunityFoundationScreen() {
  return <CommunityPage title="Comunidade"><Card title="Página não encontrada">
    <Copy secondary>Este espaço não está disponível.</Copy>
    <Action label="Voltar à comunidade" onPress={() => router.replace("/community" as Href)} />
  </Card></CommunityPage>;
}
