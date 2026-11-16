import { useCallback, useEffect, useRef, useState } from "react";
import { router, type Href } from "expo-router";
import { Switch, Text, View } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { publicLabel, type CommunityClubsGateway, type ThreadSummary } from "../domain/clubs";
import { SocialError } from "../domain/social";
import { useCommunity, useCommunityFocus } from "./CommunityProvider";
import { Action, Card, CommunityGate, CommunityPage, Copy } from "./components";
import { Field } from "./ContentReport";

const message = (error: unknown) => error instanceof SocialError ? error.message : "Não foi possível concluir. Tente de novo.";
const threadHref = (id: string) => `/community/thread/${id}` as Href;

/** Fóruns (Etapa 3): tópicos recentes, busca pelo título e novo tópico com aviso de spoiler. Sem contagem de respostas. */
export function CommunityForumsScreen() {
  useCommunityFocus();
  const { social } = useCommunity(), { palette } = useAppTheme();
  const [threads, setThreads] = useState<{ gateway: CommunityClubsGateway; list: ThreadSummary[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""), [writing, setWriting] = useState(false);
  const [title, setTitle] = useState(""), [body, setBody] = useState(""), [spoilers, setSpoilers] = useState(false);
  const run = useRef(0);

  const load = useCallback(async (search = "") => {
    const current = ++run.current;
    setFailure(null);
    if (!social) return;
    try { const list = await social.listThreads(search); if (run.current === current) setThreads({ gateway: social, list }); }
    catch (error) { if (run.current === current) setFailure(message(error)); }
  }, [social]);
  useEffect(() => { setNotice(null); void load(); }, [load]);

  const act = async (work: (gateway: CommunityClubsGateway) => Promise<string | void>) => {
    if (!social || busy) return;
    setBusy(true); setNotice(null);
    try { const done = await work(social); if (done) setNotice(done); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  };
  const list = threads?.gateway === social ? threads.list : null;

  return <CommunityPage title="Fóruns"><CommunityGate>
    <Copy secondary>Conversas sobre livros entre contas do Aldus. Marque spoiler quando contar o que acontece; quem lê escolhe se quer ver.</Copy>
    {notice ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{notice}</Text> : null}
    <Card title="Novo tópico">
      {!writing ? <Action label="Escrever um tópico" disabled={busy} onPress={() => setWriting(true)} /> : <>
        <Field label="Título" value={title} onChange={setTitle} busy={busy} maxLength={140} />
        <Field label="Texto" value={body} onChange={setBody} busy={busy} multiline maxLength={4000} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
          <Text style={{ color: palette.text, flex: 1 }}>Contém spoiler</Text>
          <Switch accessibilityLabel="Contém spoiler" value={spoilers} onValueChange={setSpoilers} />
        </View>
        <Action label="Publicar tópico" disabled={busy} onPress={() => void act(async gateway => {
          const id = await gateway.createThread(title, body, spoilers);
          setWriting(false); setTitle(""); setBody(""); setSpoilers(false); router.push(threadHref(id));
        })} />
        <Action label="Cancelar" disabled={busy} onPress={() => setWriting(false)} />
      </>}
    </Card>
    <Card title="Tópicos recentes">
      <Field label="Buscar pelo título" value={query} onChange={setQuery} busy={busy} maxLength={80} />
      <Action label="Buscar" disabled={busy} onPress={() => void load(query)} />
      {failure ? <><Text accessibilityRole="alert" style={{ color: palette.text }}>{failure}</Text><Action label="Tentar novamente" disabled={busy} onPress={() => void load(query)} /></>
        : list === null ? <Copy secondary>Consultando…</Copy>
        : list.length === 0 ? <Copy secondary>{query.trim() ? "Nenhum tópico com esse título." : "Ainda não há tópicos. Que tal começar um?"}</Copy>
        : list.map(thread => <Action key={thread.id} label={`${thread.title}${thread.containsSpoilers ? " · contém spoiler" : ""} · ${publicLabel(thread.author)}`} onPress={() => router.push(threadHref(thread.id))} />)}
    </Card>
    <Action label="Voltar à comunidade" onPress={() => router.replace("/community" as Href)} />
  </CommunityGate></CommunityPage>;
}
