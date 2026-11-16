import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Share, Text } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { CLUB_DRM_NOTICE, commentsByMilestone, publicLabel, type ClubComment, type ClubDetail, type CommunityClubsGateway } from "../domain/clubs";
import { SocialError } from "../domain/social";
import { useCommunity, useCommunityFocus } from "./CommunityProvider";
import { Action, Card, CommunityGate, CommunityPage, Copy } from "./components";
import { ContentReport, Field } from "./ContentReport";

const message = (error: unknown) => error instanceof SocialError ? error.message : "Não foi possível concluir. Tente de novo.";

/**
 * Um clube (Etapa 3). Cada membro marca até onde leu; os comentários só aparecem até esse marco e só se comenta um marco já
 * alcançado. O dono vê o código do convite, gera outro, remove membros e comentários e pode excluir o clube.
 */
export function CommunityClubScreen() {
  useCommunityFocus();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const clubId = typeof raw === "string" ? raw : "";
  const { social } = useCommunity(), { palette } = useAppTheme();
  const [state, setState] = useState<{ gateway: CommunityClubsGateway; clubId: string; detail: ClubDetail; comments: ClubComment[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(""), [draftMilestone, setDraftMilestone] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const run = useRef(0);

  const load = useCallback(async () => {
    const current = ++run.current;
    setFailure(null);
    if (!social) return;
    try {
      const [detail, comments] = await Promise.all([social.clubDetail(clubId), social.listClubComments(clubId)]);
      if (run.current === current) { setState({ gateway: social, clubId, detail, comments }); setDraftMilestone(value => value >= 1 && value <= detail.me.reachedMilestone ? value : detail.me.reachedMilestone); }
    } catch (error) { if (run.current === current) setFailure(message(error)); }
  }, [social, clubId]);
  useEffect(() => { setNotice(null); setConfirm(null); void load(); }, [load]);

  const act = async (work: (gateway: CommunityClubsGateway) => Promise<string | void>, reload = true) => {
    if (!social || busy) return false;
    setBusy(true); setNotice(null);
    try { const done = await work(social); if (reload) await load(); if (done) setNotice(done); return true; }
    catch (error) { setNotice(message(error)); return false; }
    finally { setBusy(false); }
  };
  const current = state?.gateway === social && state.clubId === clubId ? state : null;
  const detail = current?.detail, reached = detail?.me.reachedMilestone ?? 0, owner = detail?.me.role === "owner";

  return <CommunityPage title={detail?.club.name ?? "Clube"}><CommunityGate>
    {notice ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{notice}</Text> : null}
    {failure ? <Card title="Clube indisponível"><Text accessibilityRole="alert" style={{ color: palette.text }}>{failure}</Text><Action label="Tentar novamente" disabled={busy} onPress={() => void load()} /></Card>
      : !detail ? <Copy secondary>Consultando…</Copy> : <>
        <Card title={detail.club.bookTitle}>
          {detail.club.description ? <Copy>{detail.club.description}</Copy> : null}
          <Copy secondary>{CLUB_DRM_NOTICE}</Copy>
        </Card>
        <Card title="Até onde você leu">
          <Copy secondary>Os membros do clube veem o marco que você marcar. Comentários de marcos à frente ficam escondidos até você chegar lá.</Copy>
          {detail.club.milestones.map((label, index) => <Action key={label + index} disabled={busy}
            label={`${reached === index + 1 ? "Você está aqui: " : reached > index ? "Lido: " : ""}${label}`}
            onPress={() => void act(async gateway => { await gateway.setClubMilestone(clubId, index + 1); return `Marco atualizado: ${label}.`; })} />)}
          {reached > 0 ? <Action label="Ainda não comecei" disabled={busy} onPress={() => void act(async gateway => { await gateway.setClubMilestone(clubId, 0); })} /> : null}
        </Card>
        <Card title="Comentários">
          {reached === 0 ? <Copy secondary>Marque um marco para ler e escrever comentários até ele.</Copy> : <>
            {commentsByMilestone(current!.comments, detail.club.milestones).map(group => <Card key={group.milestone} title={group.label}>
              {group.comments.map(comment => <Card key={comment.id}>
                <Copy secondary>{publicLabel(comment.author)}</Copy>
                <Copy>{comment.body}</Copy>
                {comment.mine || owner ? <Action label="Remover comentário" disabled={busy} onPress={() => void act(async gateway => { await gateway.removeClubComment(comment.id); return "Comentário removido."; })} /> : null}
                {!comment.mine ? <ContentReport label="comentário" busy={busy} onSend={(reason, text) => act(async gateway => { await gateway.reportContent("club_comment", comment.id, reason, text); return "Denúncia enviada."; }, false)} /> : null}
              </Card>)}
            </Card>)}
            {!current!.comments.length ? <Copy secondary>Ninguém comentou até o seu marco ainda.</Copy> : null}
            <Copy>Comentar sobre</Copy>
            {detail.club.milestones.slice(0, reached).map((label, index) => <Action key={`m${index}`} disabled={busy}
              label={`${draftMilestone === index + 1 ? "Selecionado: " : ""}comentar sobre ${label}`} onPress={() => setDraftMilestone(index + 1)} />)}
            <Field label="Seu comentário" value={draft} onChange={setDraft} busy={busy} multiline maxLength={2000} />
            <Action label="Publicar comentário" disabled={busy || !draft.trim() || draftMilestone < 1} onPress={() => void act(async gateway => {
              await gateway.addClubComment(clubId, draftMilestone, draft); setDraft(""); return "Comentário publicado para o clube.";
            })} />
          </>}
        </Card>
        <Card title="Membros">
          {detail.members.map(member => <Card key={member.userId}>
            <Copy>{publicLabel(member)}{member.role === "owner" ? " · criou o clube" : ""}</Copy>
            <Copy secondary>{member.reachedMilestone ? `Leu até: ${detail.club.milestones[member.reachedMilestone - 1]}` : "Ainda não marcou"}</Copy>
            {owner && member.role !== "owner" ? (confirm === `member:${member.userId}`
              ? <><Action label={`Confirmar: remover @${member.username}`} disabled={busy} onPress={() => void act(async gateway => { await gateway.removeClubMember(clubId, member.userId); setConfirm(null); return "Membro removido."; })} />
                <Action label="Manter" disabled={busy} onPress={() => setConfirm(null)} /></>
              : <Action label={`Remover @${member.username} do clube`} disabled={busy} onPress={() => setConfirm(`member:${member.userId}`)} />) : null}
          </Card>)}
        </Card>
        {owner ? <Card title="Convite">
          <Copy>Código: {detail.club.inviteCode}</Copy>
          <Copy secondary>Envie o código a quem você quer convidar. Quem tiver o código pode entrar; gere outro para que o antigo pare de valer.</Copy>
          <Action label="Compartilhar código" disabled={busy} onPress={() => void Share.share({ message: `Entre no clube "${detail.club.name}" no Aldus com o código ${detail.club.inviteCode}. ${CLUB_DRM_NOTICE}` }).catch(() => undefined)} />
          <Action label="Gerar novo código" disabled={busy} onPress={() => void act(async gateway => { await gateway.regenerateInvite(clubId); return "Novo código gerado. O anterior não vale mais."; })} />
        </Card> : null}
        <Card>
          {owner ? (confirm === "delete"
            ? <><Copy secondary>Excluir apaga o clube, os comentários e a participação de todos. Não dá para desfazer.</Copy>
              <Action label="Confirmar: excluir o clube" disabled={busy} onPress={() => void act(async gateway => { await gateway.deleteClub(clubId); router.replace("/community/clubs" as Href); }, false)} />
              <Action label="Manter o clube" disabled={busy} onPress={() => setConfirm(null)} /></>
            : <Action label="Excluir o clube" disabled={busy} onPress={() => setConfirm("delete")} />)
          : (confirm === "leave"
            ? <><Action label="Confirmar: sair do clube" disabled={busy} onPress={() => void act(async gateway => { await gateway.leaveClub(clubId); router.replace("/community/clubs" as Href); }, false)} />
              <Action label="Ficar no clube" disabled={busy} onPress={() => setConfirm(null)} /></>
            : <Action label="Sair do clube" disabled={busy} onPress={() => setConfirm("leave")} />)}
        </Card>
      </>}
    <Action label="Voltar aos clubes" onPress={() => router.replace("/community/clubs" as Href)} />
  </CommunityGate></CommunityPage>;
}
