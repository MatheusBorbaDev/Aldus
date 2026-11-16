import { useState } from "react";
import { TextInput } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { reportReasonLabels, reportReasons, type ReportReason } from "../domain/social";
import { Action, Copy } from "./components";

/**
 * Denúncia de um conteúdo (comentário de clube, tópico ou resposta). Vai para a administração; o autor não vê quem denunciou.
 * Abre sem motivo escolhido: o envio só é liberado depois que a pessoa escolhe um.
 */
export function ContentReport({ label, busy, onSend }: { label: string; busy: boolean; onSend: (reason: ReportReason, details: string) => Promise<boolean> }) {
  const { palette } = useAppTheme();
  const [open, setOpen] = useState(false), [reason, setReason] = useState<ReportReason | null>(null), [details, setDetails] = useState("");
  const close = () => { setOpen(false); setReason(null); setDetails(""); };
  if (!open) return <Action label={`Denunciar ${label}`} disabled={busy} onPress={() => setOpen(true)} />;
  return <>
    <Copy secondary>Escolha o motivo. A denúncia vai para a administração do Aldus; ninguém vê quem denunciou.</Copy>
    {reportReasons.map(value => <Action key={value} label={`${reason === value ? "Selecionado: " : ""}${reportReasonLabels[value]}`} disabled={busy} onPress={() => setReason(value)} />)}
    <TextInput accessibilityLabel="Detalhes da denúncia (opcional)" value={details} onChangeText={setDetails} editable={!busy} multiline maxLength={1000}
      style={{ color: palette.text, backgroundColor: palette.input, borderColor: palette.border, borderWidth: 1, borderRadius: 6, padding: 12, minHeight: 72, textAlignVertical: "top" }} />
    <Action label="Enviar denúncia" disabled={busy || reason === null} onPress={() => { if (reason) void onSend(reason, details).then(sent => { if (sent) close(); }); }} />
    <Action label="Cancelar denúncia" disabled={busy} onPress={close} />
  </>;
}

export function Field({ label, value, onChange, busy, multiline = false, maxLength }: { label: string; value: string; onChange: (value: string) => void; busy: boolean; multiline?: boolean; maxLength: number }) {
  const { palette } = useAppTheme();
  return <>
    <Copy>{label}</Copy>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!busy} multiline={multiline} maxLength={maxLength}
      style={{ color: palette.text, backgroundColor: palette.input, borderColor: palette.border, borderWidth: 1, borderRadius: 6, padding: 12, minHeight: multiline ? 96 : 48, textAlignVertical: "top" }} />
  </>;
}
