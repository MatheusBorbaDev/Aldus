import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Text, TextInput } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import {
  type CommunitySocialGateway, type PublishedProfile, type ReaderLookup, type ReportReason, SocialError,
  normalizeUsernameQuery, relationAction, reportReasonLabels, reportReasons,
} from "../domain/social";
import { useCommunity, useCommunityFocus } from "./CommunityProvider";
import { Action, Card, CommunityGate, CommunityPage, Copy, ProfileIdentity } from "./components";

const message = (error: unknown) => error instanceof SocialError ? error.message : "Não foi possível concluir. Tente de novo.";

/** Perfil de outro leitor. Mostra só o que o servidor liberou para esta conta; nada de biblioteca, progresso ou números. */
export function CommunityReaderScreen() {
  useCommunityFocus();
  const { username: raw } = useLocalSearchParams<{ username: string }>();
  const username = normalizeUsernameQuery(typeof raw === "string" ? raw : "");
  const { social } = useCommunity(), { palette } = useAppTheme();
  const [state, setState] = useState<{ social: CommunitySocialGateway; username: string; reader: ReaderLookup | null; profile: PublishedProfile | null } | null>(null);
  const [failure, setFailure] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false), [reason, setReason] = useState<ReportReason | null>(null), [details, setDetails] = useState("");
  const run = useRef(0);

  const load = useCallback(async () => {
    const current = ++run.current;
    setFailure(null);
    if (!social) return;
    try {
      const reader = await social.findReader(username);
      const profile = reader && reader.relation !== "self" ? await social.readProfile(reader.userId) : null;
      if (run.current === current) setState({ social, username, reader, profile });
    } catch (error) { if (run.current === current) setFailure(message(error)); }
  }, [social, username]);
  useEffect(() => { setNotice(null); setConfirmBlock(false); setReason(null); setDetails(""); void load(); }, [load]);

  const act = async (work: (gateway: CommunitySocialGateway) => Promise<string | void>, reload = true) => {
    if (!social || busy) return;
    setBusy(true); setNotice(null);
    try { const done = await work(social); if (reload) await load(); if (done) setNotice(done); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  };
  const current = state?.social === social && state.username === username ? state : null;
  const reader = current?.reader ?? null, profile = current?.profile ?? null;
  const main = reader ? relationAction(reader) : null;

  return <CommunityPage title={reader ? `@${reader.username}` : "Leitor"}><CommunityGate>
    {notice ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{notice}</Text> : null}
    {failure ? <Card title="Não foi possível abrir"><Text accessibilityRole="alert" style={{ color: palette.text }}>{failure}</Text><Action label="Tentar novamente" disabled={busy} onPress={() => void load()} /></Card>
      : !current ? <Copy secondary>Consultando a rede…</Copy>
      : !reader ? <Card title="Leitor não encontrado"><Copy secondary>Este @usuário não existe, é privado ou não está disponível para você.</Copy></Card>
      : reader.relation === "self" ? <Card><Copy>Este é o seu perfil.</Copy><Action label="Abrir meu perfil literário" onPress={() => router.replace("/community/profile" as Href)} /></Card>
      : <>
        <Card>
          <ProfileIdentity profile={{ displayName: profile?.displayName ?? reader.displayName ?? reader.username, username: reader.username, avatar: profile?.avatar ?? reader.avatar }} />
          {reader.followsMe ? <Copy secondary>Segue você.</Copy> : null}
          {profile ? <Copy>{profile.bio || "Sem bio."}</Copy> : <Copy secondary>{reader.relation === "pending" ? "Pedido enviado. O perfil completo aparece quando for aceito." : "Este perfil é só para seguidores."}</Copy>}
          {main?.action ? <Action label={main.label} disabled={busy} onPress={() => void act(async gateway => {
            if (main.action === "unfollow") { await gateway.unfollow(reader.userId); return; }
            return await gateway.follow(reader.userId) === "pending" ? "Pedido enviado." : "Você agora segue este leitor.";
          })} /> : null}
        </Card>
        {profile ? <Card title="Entre as leituras">
          <Copy>Gêneros favoritos: {profile.favoriteGenres.join(", ") || "não informados"}</Copy>
          <Copy>Autores favoritos: {profile.favoriteAuthors.join(", ") || "não informados"}</Copy>
          <Copy>Livros favoritos: {profile.favoriteBooks.join(", ") || "não informados"}</Copy>
          {profile.readingGoal ? <Copy>Meta: {profile.readingGoal.books} livros em {profile.readingGoal.year}</Copy> : null}
        </Card> : null}
        <Card title="Segurança">
          {confirmBlock ? <>
            <Copy secondary>Bloquear encerra o seguir nos dois sentidos e vocês deixam de ver o perfil um do outro. A pessoa não é avisada.</Copy>
            <Action label={`Confirmar: bloquear @${reader.username}`} disabled={busy} onPress={() => void act(async gateway => { await gateway.block(reader.userId); router.replace("/community/people" as Href); }, false)} />
            <Action label="Não bloquear" disabled={busy} onPress={() => setConfirmBlock(false)} />
          </> : <Action label={`Bloquear @${reader.username}`} disabled={busy} onPress={() => setConfirmBlock(true)} />}
          {reason === null ? <Action label={`Denunciar @${reader.username}`} disabled={busy} onPress={() => setReason("spam")} /> : <>
            <Copy secondary>Escolha o motivo. A denúncia vai para a administração do Aldus; a pessoa não vê quem denunciou.</Copy>
            {reportReasons.map(value => <Action key={value} label={`${reason === value ? "Selecionado: " : ""}${reportReasonLabels[value]}`} disabled={busy} onPress={() => setReason(value)} />)}
            <TextInput accessibilityLabel="Detalhes da denúncia (opcional)" value={details} onChangeText={setDetails} editable={!busy} multiline maxLength={1000}
              style={{ color: palette.text, backgroundColor: palette.input, borderColor: palette.border, borderWidth: 1, borderRadius: 6, padding: 12, minHeight: 80, textAlignVertical: "top" }} />
            <Action label="Enviar denúncia" disabled={busy} onPress={() => void act(async gateway => { await gateway.report(reader.userId, reason, details); setReason(null); setDetails(""); return "Denúncia enviada."; }, false)} />
            <Action label="Cancelar denúncia" disabled={busy} onPress={() => { setReason(null); setDetails(""); }} />
          </>}
        </Card>
      </>}
    <Action label="Voltar a Pessoas" onPress={() => router.replace("/community/people" as Href)} />
  </CommunityGate></CommunityPage>;
}
