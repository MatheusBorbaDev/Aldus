import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AdminVestibularData } from '../domain/contracts';
import { adminRepository } from '../data/AdminRepository';
import { parseBookLines } from '@/src/domain/study/vestibularReadings';
import { Button, Card, dateLabel, Field, Label, Muted, rowStyle } from './components';

/**
 * Admin · Leituras de vestibular (25/11/2026, dono: "Admin + robô avisa"). Avisos do robô (página oficial mudou), sugestões de quem usa
 * o app e as listas publicadas. Publicar ou corrigir: cola as obras do edital, uma por linha, com o link oficial. Toda ação pede motivo e
 * MFA recente, e fica na auditoria.
 */
export function AdminVestibular({ data, enabled, onChanged }: { data: AdminVestibularData; enabled: boolean; onChanged: () => void }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [vestibular, setVestibular] = useState(data.vestibulares[0]?.id ?? ''), [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [source, setSource] = useState(''), [pasted, setPasted] = useState('');
  const name = (id: string | null) => data.vestibulares.find(v => v.id === id)?.name ?? 'Geral';
  const reasonOk = reason.trim().length >= 8;
  const run = async (action: Parameters<typeof adminRepository.vestibularChange>[0], v: string | null, y: number | null, payload: object, done: string) => {
    setBusy(true); setMessage('');
    const controller = new AbortController();
    try { await adminRepository.vestibularChange(action, v, y, payload, reason.trim(), controller.signal); setMessage(done); onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };
  const parsed = parseBookLines(pasted), yearNumber = Number(year);
  const publishErrors = [
    ...(!/^\d{4}$/.test(year) || yearNumber < 1990 || yearNumber > 2100 ? ['Ano inválido.'] : []),
    ...(!/^https:\/\/\S+$/.test(source.trim()) ? ['Informe o link https do edital ou da página oficial.'] : []),
    ...(pasted.trim() ? parsed.errors : ['Cole as obras do edital.']),
  ];
  const disabled = !enabled || busy || !reasonOk;
  return <>
    {!enabled ? <Card title="Confirmação em duas etapas"><Muted>Para alterar, confirme o código do autenticador (MFA) nesta sessão.</Muted></Card> : null}
    <Card title="Motivo das alterações">
      <Muted>Obrigatório (8 caracteres ou mais). Vai para a auditoria junto com cada ação abaixo.</Muted>
      <Field label="Motivo" value={reason} onChange={setReason} />
      {message ? <Label>{message}</Label> : null}
    </Card>
    <Card title={`Avisos do robô (${data.alerts.length})`}>
      <Muted>O robô confere as páginas oficiais uma vez por dia e avisa quando aparece PDF novo. Ele nunca publica: confira o edital e publique abaixo.</Muted>
      {data.alerts.length ? data.alerts.map(a => <View key={a.vestibular_id} style={rowStyle}>
        <Label>{name(a.vestibular_id)}: página mudou em {dateLabel(a.changed_at)}</Label>
        <Button title="Abrir página" onPress={() => { const url = data.vestibulares.find(v => v.id === a.vestibular_id)?.watch_url; if (url) void Linking.openURL(url); }} />
        <Button title="Conferido" disabled={disabled} onPress={() => void run('alert_seen', a.vestibular_id, null, {}, 'Aviso marcado como conferido.')} />
      </View>) : <Muted>Nenhum aviso pendente.</Muted>}
    </Card>
    <Card title={`Sugestões (${data.suggestions.length})`}>
      {data.suggestions.length ? data.suggestions.map(s => <View key={s.id} style={{ gap: 4, marginBottom: 8 }}>
        <Label>{name(s.vestibular_id)} · {dateLabel(s.created_at)}</Label>
        <Muted>{s.message}</Muted>
        <Button title="Resolvida" disabled={disabled} onPress={() => void run('suggestion_done', null, null, { id: s.id }, 'Sugestão marcada como resolvida.')} />
      </View>) : <Muted>Nenhuma sugestão em aberto.</Muted>}
    </Card>
    <Card title="Publicar ou corrigir uma lista">
      <Muted>Uma obra por linha, no formato "Título — Autor", na ordem do edital. Publicar de novo o mesmo vestibular e ano substitui a lista.</Muted>
      <View style={rowStyle}>{data.vestibulares.map(v => <Button key={v.id} title={v.name} selected={vestibular === v.id} onPress={() => setVestibular(v.id)} />)}</View>
      <Field label="Ano da edição (ex.: 2027)" value={year} onChange={setYear} />
      <Field label="Link oficial (https)" value={source} onChange={setSource} />
      <Field label="Obras" value={pasted} onChange={setPasted} multiline />
      {pasted.trim() && !parsed.errors.length ? <Muted>{parsed.books.length} obras reconhecidas.</Muted> : null}
      {publishErrors.map(e => <Label key={e}>{e}</Label>)}
      <Button title={`Publicar ${name(vestibular)} ${year}`} disabled={disabled || publishErrors.length > 0}
        onPress={() => void run('publish', vestibular, yearNumber, { source_url: source.trim(), books: parsed.books.map(b => ({ position: b.position, title: b.title, author: b.author })) }, 'Lista publicada.')} />
    </Card>
    <Card title={`Listas publicadas (${data.lists.length})`}>
      {data.lists.length ? data.lists.map(l => <View key={`${l.vestibular_id}-${l.exam_year}`} style={rowStyle}>
        <Label>{name(l.vestibular_id)} {l.exam_year} · {l.books.length} obras · {dateLabel(l.updated_at)}</Label>
        <Button title="Editar" onPress={() => { setVestibular(l.vestibular_id); setYear(String(l.exam_year)); setSource(l.source_url); setPasted(l.books.map(b => `${b.title} — ${b.author}`).join('\n')); }} />
        <Button title="Remover" disabled={disabled} onPress={() => void run('remove', l.vestibular_id, l.exam_year, {}, 'Lista removida.')} />
      </View>) : <Muted>Nenhuma lista publicada ainda.</Muted>}
    </Card>
  </>;
}
