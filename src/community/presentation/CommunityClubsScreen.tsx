import { useCallback, useEffect, useRef, useState } from "react";
import { router, type Href } from "expo-router";
import { Text } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { CLUB_DRM_NOTICE, normalizeInviteCode, parseMilestoneLines, type ClubSummary, type CommunityClubsGateway } from "../domain/clubs";
import { SocialError } from "../domain/social";
import { useCommunity, useCommunityFocus } from "./CommunityProvider";
import { Action, Card, CommunityGate, CommunityPage, Copy } from "./components";
import { Field } from "./ContentReport";

const message = (error: unknown) => error instanceof SocialError ? error.message : "Não foi possível concluir. Tente de novo.";
const clubHref = (id: string) => `/community/club/${id}` as Href;

/** Clubes de leitura por convite (Etapa 3): os clubes da conta, criar um clube e entrar com um código. Sem contagem de membros. */
export function CommunityClubsScreen() {
  useCommunityFocus();
  const { social } = useCommunity(), { palette } = useAppTheme();
  const [clubs, setClubs] = useState<{ gateway: CommunityClubsGateway; list: ClubSummary[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [code, setCode] = useState(""), [creating, setCreating] = useState(false);
  const [name, setName] = useState(""), [bookTitle, setBookTitle] = useState(""), [description, setDescription] = useState(""), [milestones, setMilestones] = useState("");
  const run = useRef(0);

  const load = useCallback(async () => {
    const current = ++run.current;
    setFailure(null);
    if (!social) return;
    try { const list = await social.listMyClubs(); if (run.current === current) setClubs({ gateway: social, list }); }
    catch (error) { if (run.current === current) setFailure(message(error)); }
  }, [social]);
  useEffect(() => { setNotice(null); void load(); }, [load]);

  const act = async (work: (gateway: CommunityClubsGateway) => Promise<string | void>) => {
    if (!social || busy) return;
    setBusy(true); setNotice(null);
    try { const done = await work(social); await load(); if (done) setNotice(done); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  };
  const list = clubs?.gateway === social ? clubs.list : null;

  return <CommunityPage title="Clubes"><CommunityGate>
    <Copy secondary>Leitura conjunta só com quem você convidar. Os comentários ficam presos aos marcos do livro: ninguém vê o que vem depois do ponto onde está.</Copy>
    <Copy secondary>{CLUB_DRM_NOTICE}</Copy>
    {notice ? <Text accessibilityRole="alert" style={{ color: palette.text }}>{notice}</Text> : null}
    <Card title="Seus clubes">
      {failure ? <><Text accessibilityRole="alert" style={{ color: palette.text }}>{failure}</Text><Action label="Tentar novamente" disabled={busy} onPress={() => void load()} /></>
        : list === null ? <Copy secondary>Consultando…</Copy>
        : list.length === 0 ? <Copy secondary>Você ainda não participa de nenhum clube.</Copy>
        : list.map(club => <Action key={club.id} label={`${club.name} · ${club.bookTitle}${club.role === "owner" ? " · criado por você" : ""}`} onPress={() => router.push(clubHref(club.id))} />)}
    </Card>
    {list !== null ? <>
      <Card title="Entrar com um código">
        <Field label="Código do convite" value={code} onChange={setCode} busy={busy} maxLength={14} />
        <Action label="Entrar no clube" disabled={busy || normalizeInviteCode(code).length !== 10} onPress={() => void act(async gateway => {
          const id = await gateway.joinClub(code); setCode(""); router.push(clubHref(id));
        })} />
      </Card>
      <Card title="Criar um clube">
        {!creating ? <Action label="Criar um clube" disabled={busy} onPress={() => setCreating(true)} /> : <>
          <Field label="Nome do clube" value={name} onChange={setName} busy={busy} maxLength={80} />
          <Field label="Livro (só o título)" value={bookTitle} onChange={setBookTitle} busy={busy} maxLength={200} />
          <Field label="Descrição (opcional)" value={description} onChange={setDescription} busy={busy} multiline maxLength={600} />
          <Field label="Marcos de leitura, um por linha (de 2 a 12)" value={milestones} onChange={setMilestones} busy={busy} multiline maxLength={1600} />
          <Copy secondary>Exemplo: "Capítulos 1 a 20" numa linha e "Capítulos 21 ao fim" na outra. O clube recebe um código para você enviar a quem quiser convidar.</Copy>
          <Action label="Salvar clube" disabled={busy} onPress={() => void act(async gateway => {
            const created = await gateway.createClub(name.trim(), description.trim(), bookTitle.trim(), parseMilestoneLines(milestones));
            setCreating(false); setName(""); setBookTitle(""); setDescription(""); setMilestones("");
            router.push(clubHref(created.clubId));
          })} />
          <Action label="Cancelar" disabled={busy} onPress={() => setCreating(false)} />
        </>}
      </Card>
    </> : null}
    <Action label="Voltar à comunidade" onPress={() => router.replace("/community" as Href)} />
  </CommunityGate></CommunityPage>;
}
