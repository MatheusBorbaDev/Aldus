import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Switch, Text, View } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { publicLabel, type CommunityClubsGateway, type ThreadDetail } from "../domain/clubs";
import { SocialError } from "../domain/social";
import { useCommunity, useCommunityFocus } from "./CommunityProvider";
import { Action, Card, CommunityGate, CommunityPage, Copy } from "./components";
import { ContentReport, Field } from "./ContentReport";

const message = (error: unknown) => error instanceof SocialError ? error.message : "Não foi possível concluir. Tente de novo.";

/** Um tópico do fórum: texto e respostas; spoiler escondido até a pessoa pedir; autor remove o que escreveu; denúncia. */
export function CommunityThreadScreen() {
  useCommunityFocus();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const threadId = typeof raw === "string" ? raw : "";
  const { social } = useCommunity(), { palette } = useAppTheme();
  const [state, setState] = useState<{ gateway: CommunityClubsGateway; threadId: string; detail: ThreadDetail } | null>(null);
  const [failure, setFailure] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set()), [reply, setReply] = useState(""), [spoilers, setSpoilers] = useState(false);
  const run = useRef(0);

  const load = useCallback(async () => {
    const current = ++run.current;
    setFailure(null);
    if (!social) return;
    try { const detail = await social.threadDetail(threadId); if (run.current === current) setState({ gateway: social, threadId, detail }); }
    catch (error) { if (run.current === current) setFailure(message(error)); }
  }, [social, threadId]);
  useEffect(() => { setNotice(null); setRevealed(new Set()); void load(); }, [load]);

  const act = async (work: (gateway: CommunityClubsGateway) => Promise<string | void>, reload = true) => {
    if (!social || busy) return false;
    setBusy(true); setNotice(null);
    try { const done = await work(social); if (reload) await load(); if (done) setNotice(done); return true; }
    catch (error) { setNotice(message(error)); return false; }
    finally { setBusy(false); }
  };
  const detail = state?.gateway === social && state.threadId === threadId ? state.detail : null;
  const body = (id: string, text: string, spoiler: boolean) => spoiler && !revealed.has(id)
    ? <Action label="Contém spoiler · mostrar" onPress={() => setRevealed(previous => new Set(previous).add(id))} />
    : <Copy>{text}</Copy>;

  return <CommunityPage title={detail?.thread.title ?? "Tópico"}><CommunityGate>
    {notice ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{notice}</Text> : null}
    {failure ? <Card title="Tópico indisponível"><Text accessibilityRole="alert" style={{ color: palette.text }}>{failure}</Text><Action label="Voltar aos fóruns" onPress={() => router.replace("/community/forums" as Href)} /></Card>
      : !detail ? <Copy secondary>Consultando…</Copy> : <>
        <Card>
          <Copy secondary>{publicLabel(detail.thread.author)}</Copy>
          {body(detail.thread.id, detail.thread.body, detail.thread.containsSpoilers)}
          {detail.thread.mine ? <Action label="Remover meu tópico" disabled={busy} onPress={() => void act(async gateway => { await gateway.removeThread(threadId); router.replace("/community/forums" as Href); }, false)} />
            : <ContentReport label="tópico" busy={busy} onSend={(reason, text) => act(async gateway => { await gateway.reportContent("thread", threadId, reason, text); return "Denúncia enviada."; }, false)} />}
        </Card>
        <Card title="Respostas">
          {!detail.posts.length ? <Copy secondary>Ninguém respondeu ainda.</Copy> : null}
          {detail.posts.map(post => <Card key={post.id}>
            <Copy secondary>{publicLabel(post.author)}</Copy>
            {body(post.id, post.body, post.containsSpoilers)}
            {post.mine || detail.thread.mine ? <Action label="Remover resposta" disabled={busy} onPress={() => void act(async gateway => { await gateway.removePost(post.id); return "Resposta removida."; })} /> : null}
            {!post.mine ? <ContentReport label="resposta" busy={busy} onSend={(reason, text) => act(async gateway => { await gateway.reportContent("post", post.id, reason, text); return "Denúncia enviada."; }, false)} /> : null}
          </Card>)}
          <Field label="Sua resposta" value={reply} onChange={setReply} busy={busy} multiline maxLength={4000} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
            <Text style={{ color: palette.text, flex: 1 }}>Contém spoiler</Text>
            <Switch accessibilityLabel="Resposta contém spoiler" value={spoilers} onValueChange={setSpoilers} />
          </View>
          <Action label="Responder" disabled={busy || !reply.trim()} onPress={() => void act(async gateway => { await gateway.addPost(threadId, reply, spoilers); setReply(""); setSpoilers(false); })} />
        </Card>
      </>}
    <Action label="Voltar aos fóruns" onPress={() => router.replace("/community/forums" as Href)} />
  </CommunityGate></CommunityPage>;
}
