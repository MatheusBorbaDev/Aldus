import { useCallback, useEffect, useRef, useState } from "react";
import { router, type Href } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import type { Privacy } from "../domain/models";
import {
  type BlockedReader, type CommunitySocialGateway, type FollowEntry, type PublishedProfile, type ReaderCard, SocialError,
  normalizeUsernameQuery, publicationOutdated,
} from "../domain/social";
import { useCommunity, useCommunityFocus } from "./CommunityProvider";
import { Action, Card, CommunityGate, CommunityPage, Copy } from "./components";

const privacyNames: Record<Privacy, string> = { PUBLIC: "Público", FOLLOWERS: "Seguidores", PRIVATE: "Privado" };
export const PUBLISH_DISCLOSURE = "Ao publicar, outros leitores passam a ver: nome de exibição, @usuário, avatar, bio, favoritos e meta anual. Sua biblioteca, progresso, tempo de leitura, grifos e notas não são enviados.";
interface Network { publication: PublishedProfile | null; requests: FollowEntry[]; followers: FollowEntry[]; following: FollowEntry[]; sent: FollowEntry[]; blocked: BlockedReader[] }
const message = (error: unknown) => error instanceof SocialError ? error.message : "Não foi possível concluir. Tente de novo.";
const readerHref = (username: string) => `/community/reader/${username}` as Href;

/** Pessoas (Etapa 2): publicar o perfil, encontrar leitores, pedidos, quem segue e bloqueados. Nada aqui é inventado: listas vazias são vazias. */
export function CommunityPeopleScreen() {
  useCommunityFocus();
  const { view, social } = useCommunity(), { palette } = useAppTheme();
  const profile = view?.state.profile ?? null;
  const [network, setNetwork] = useState<{ social: CommunitySocialGateway; value: Network } | null>(null);
  const [failure, setFailure] = useState<{ social: CommunitySocialGateway | null; text: string } | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null), [confirmLeave, setConfirmLeave] = useState(false);
  const [query, setQuery] = useState(""), [results, setResults] = useState<ReaderCard[] | null>(null);
  const run = useRef(0);

  const load = useCallback(async () => {
    const current = ++run.current;
    setFailure(null);
    if (!social) return;
    try {
      // A primeira leitura também revela se o servidor já tem a rede; as listas só são pedidas depois dela.
      const publication = await social.ownPublication();
      const [requests, followers, following, sent, blocked] = await Promise.all([
        social.listFollows("requests"), social.listFollows("followers"), social.listFollows("following"), social.listFollows("sent"), social.listBlocked()]);
      if (run.current === current) setNetwork({ social, value: { publication, requests, followers, following, sent, blocked } });
    } catch (error) { if (run.current === current) setFailure({ social, text: message(error) }); }
  }, [social]);
  useEffect(() => { setResults(null); setNotice(null); setConfirmLeave(false); void load(); }, [load]);

  const act = async (work: (gateway: CommunitySocialGateway) => Promise<string | void>) => {
    if (!social || busy) return;
    setBusy(true); setNotice(null);
    try { const done = await work(social); await load(); if (done) setNotice(done); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  };
  const search = () => act(async gateway => {
    const text = normalizeUsernameQuery(query);
    const exact = /^[a-z][a-z0-9_]{2,23}$/.test(text) ? await gateway.findReader(text) : null;
    const found = await gateway.searchReaders(text);
    const merged = [...(exact && exact.relation !== "self" ? [exact] : []), ...found.filter(card => card.userId !== exact?.userId)];
    setResults(merged);
    return merged.length ? undefined : "Nenhum leitor encontrado. Perfis privados e para seguidores só aparecem pelo @usuário exato.";
  });

  const data = network?.social === social ? network.value : null;
  const error = failure?.social === social ? failure.text : null;
  const row = (card: { username: string; displayName: string | null }, detail: string | null, actions: Array<[string, () => void]>) => (
    <View key={card.username + (detail ?? "")} style={{ gap: 6, paddingVertical: 6 }}>
      <Copy>{card.displayName ? `${card.displayName} · @${card.username}` : `@${card.username}`}</Copy>
      {detail ? <Copy secondary>{detail}</Copy> : null}
      {actions.map(([label, onPress]) => <Action key={label} label={label} disabled={busy} onPress={onPress} />)}
    </View>
  );

  return <CommunityPage title="Pessoas"><CommunityGate>{profile && <>
    <Copy secondary>Leitores que você escolhe acompanhar. Sem contagem de seguidores, ranking ou comparação.</Copy>
    {notice ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{notice}</Text> : null}
    <Card title="Seu perfil na rede">
      {error ? <><Text accessibilityRole="alert" style={{ color: palette.text }}>{error}</Text><Action label="Tentar novamente" disabled={busy} onPress={() => void load()} /></>
        : !data ? <Copy secondary>Consultando a rede…</Copy>
        : data.publication ? <>
          <Copy>{`Publicado como ${privacyNames[data.publication.privacy]}.`}</Copy>
          <Copy secondary>{data.publication.privacy === "FOLLOWERS" ? "Só quem você aceitar vê o perfil completo; os outros veem apenas nome, @usuário e avatar." : "Qualquer pessoa pode ver este perfil."}</Copy>
          {publicationOutdated(profile, data.publication) && profile.privacy !== "PRIVATE"
            ? <Action label="Atualizar publicação com o perfil deste aparelho" disabled={busy} onPress={() => void act(async gateway => { await gateway.publish(profile); return "Publicação atualizada."; })} /> : null}
          {profile.privacy === "PRIVATE" ? <Copy secondary>O perfil deste aparelho está como Privado; a publicação continua com os dados enviados antes até você retirá-la.</Copy> : null}
          {confirmLeave
            ? <><Copy secondary>Retirar apaga o perfil publicado e remove quem segue você. Quem você segue continua.</Copy>
              <Action label="Confirmar: retirar meu perfil da rede" disabled={busy} onPress={() => void act(async gateway => { await gateway.unpublish(); setConfirmLeave(false); return "Perfil retirado da rede."; })} />
              <Action label="Manter publicado" disabled={busy} onPress={() => setConfirmLeave(false)} /></>
            : <Action label="Retirar meu perfil da rede" disabled={busy} onPress={() => setConfirmLeave(true)} />}
        </> : <>
          <Copy>Seu perfil literário está só neste aparelho.</Copy>
          <Copy secondary>{PUBLISH_DISCLOSURE}</Copy>
          {profile.privacy === "PRIVATE"
            ? <><Copy secondary>Ele está como Privado. Para publicar, escolha Público ou Seguidores.</Copy><Action label="Editar perfil e privacidade" onPress={() => router.push("/community/edit-profile" as Href)} /></>
            : <Action label={`Publicar perfil como ${privacyNames[profile.privacy]}`} disabled={busy} onPress={() => void act(async gateway => { await gateway.publish(profile); return "Perfil publicado."; })} />}
        </>}
    </Card>
    {data ? <>
      <Card title="Encontrar leitores">
        <Copy secondary>Busque pelo @usuário ou pelo começo do nome. Quem você segue vê o seu @usuário.</Copy>
        <TextInput accessibilityLabel="Buscar leitor por @usuário ou nome" value={query} onChangeText={setQuery} editable={!busy} maxLength={41} autoCapitalize="none" autoCorrect={false}
          onSubmitEditing={() => void search()} style={{ color: palette.text, backgroundColor: palette.input, borderColor: palette.border, borderWidth: 1, borderRadius: 6, padding: 12, minHeight: 48 }} />
        <Action label="Buscar" disabled={busy || normalizeUsernameQuery(query).length < 2} onPress={() => void search()} />
        {results?.map(card => row(card, card.privacy === "FOLLOWERS" ? "Perfil para seguidores" : null, [[`Ver perfil de @${card.username}`, () => router.push(readerHref(card.username))]]))}
      </Card>
      {data.requests.length ? <Card title="Pedidos para seguir você">
        {data.requests.map(entry => row(entry, null, [
          [`Aceitar @${entry.username}`, () => void act(async gateway => { await gateway.respondFollow(entry.userId, true); })],
          [`Recusar @${entry.username}`, () => void act(async gateway => { await gateway.respondFollow(entry.userId, false); })]]))}
      </Card> : null}
      <Card title="Você segue">
        {data.following.length || data.sent.length ? <>
          {data.following.map(entry => row(entry, null, [[`Ver perfil de @${entry.username}`, () => router.push(readerHref(entry.username))]]))}
          {data.sent.map(entry => row(entry, "Pedido enviado, aguardando resposta", [[`Cancelar pedido a @${entry.username}`, () => void act(async gateway => { await gateway.unfollow(entry.userId); })]]))}
        </> : <Copy secondary>Você ainda não segue ninguém.</Copy>}
      </Card>
      <Card title="Seguem você">
        {data.followers.length ? data.followers.map(entry => row(entry, null, [[`Remover @${entry.username} dos seguidores`, () => void act(async gateway => { await gateway.removeFollower(entry.userId); })]]))
          : <Copy secondary>{data.publication ? "Ninguém segue você ainda." : "Publique o perfil para que outros leitores possam seguir você."}</Copy>}
      </Card>
      {data.blocked.length ? <Card title="Bloqueados">
        {data.blocked.map(entry => row({ username: entry.username, displayName: null }, null, [[`Desbloquear @${entry.username}`, () => void act(async gateway => { await gateway.unblock(entry.userId); })]]))}
      </Card> : null}
    </> : null}
    <Action label="Voltar à comunidade" onPress={() => router.replace("/community" as Href)} />
  </>}</CommunityGate></CommunityPage>;
}
