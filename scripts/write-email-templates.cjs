// Modelos de e-mail do Supabase Auth em português, com a identidade do Aldus (25/11/2026, dono: "tem como fazer uns emails
// bonitinhos?"). Um layout único gera os seis modelos em supabase/templates/. HTML de e-mail: tabelas e estilo inline (Gmail/Outlook),
// sem fonte externa nem script; a medalha vem do próprio site. Textos aprovados pelo dono em 25/11/2026.
const fs = require('node:fs'), path = require('node:path');
const SITE = 'https://aldusreader.com.br';
const OUT = path.join(__dirname, '..', 'supabase', 'templates');
// Redes do Aldus (mesma lista de src/marketing/socialLinks.tsx; conferido em test-email-templates). Ícones PNG em public/email/.
const SOCIAL = [['instagram', 'Instagram', 'https://www.instagram.com/aldus_reader/'], ['tiktok', 'TikTok', 'https://www.tiktok.com/@aldusreader'],
  ['x', 'X', 'https://x.com/Aldusreader'], ['facebook', 'Facebook', 'https://www.facebook.com/61596730780151/']];
const socialRow = SOCIAL.map(([id, label, url]) => `<a href="${url}" style="display:inline-block;margin:0 7px;"><img src="${SITE}/email/social-${id}.png" width="22" height="22" alt="${label}" style="display:block;border:0;width:22px;height:22px;"></a>`).join('');
const c = { night: '#1B1C30', cream: '#F7F4EE', card: '#FFFDF9', ink: '#1F2D2B', soft: '#68716D', line: '#DDD8CF', accent: '#A64E32', medalCream: '#F2E6CF' };
const serif = "Georgia, 'Times New Roman', serif", sans = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function layout({ preheader, title, intro, action, after, why }) {
  const button = action ? `
          <tr><td align="center" style="padding:8px 0 24px;">
            <a href="${action.url}" style="display:inline-block;background:${c.accent};color:#FFFFFF;font-family:${sans};font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">${action.label}</a>
          </td></tr>
          <tr><td style="font-family:${sans};font-size:13px;line-height:20px;color:${c.soft};padding:0 0 20px;">
            Se o botão não abrir, copie este endereço no navegador:<br><a href="${action.url}" style="color:${c.accent};word-break:break-all;">${action.url}</a>
          </td></tr>` : '';
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${c.cream};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.cream};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${c.card};border:1px solid ${c.line};border-radius:16px;overflow:hidden;">
        <tr><td align="center" style="background:${c.night};padding:28px 24px 22px;">
          <img src="${SITE}/email/aldus-medalha.png" width="72" height="72" alt="" style="display:block;border:0;width:72px;height:72px;">
          <div style="font-family:${serif};font-size:22px;letter-spacing:1px;color:${c.medalCream};padding-top:12px;">Aldus Reader</div>
        </td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-family:${serif};font-size:26px;line-height:32px;color:${c.ink};padding:0 0 16px;">${title}</td></tr>
          <tr><td style="font-family:${sans};font-size:16px;line-height:25px;color:${c.ink};padding:0 0 24px;">${intro}</td></tr>${button}
          ${after ? `<tr><td style="font-family:${sans};font-size:15px;line-height:23px;color:${c.ink};padding:0 0 24px;">${after}</td></tr>` : ''}
          <tr><td style="border-top:1px solid ${c.line};font-family:${sans};font-size:13px;line-height:20px;color:${c.soft};padding:18px 0 28px;">${why}</td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td align="center" style="padding:20px 8px 0;">${socialRow}</td></tr>
        <tr><td align="center" style="font-family:${sans};font-size:12px;line-height:18px;color:${c.soft};padding:12px 8px 0;">
          Aldus Reader · <a href="${SITE}" style="color:${c.soft};">aldusreader.com.br</a> · Dúvidas: <a href="mailto:suporte@aldusreader.com.br" style="color:${c.soft};">suporte@aldusreader.com.br</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;
}

const ignore = 'Se não foi você, pode ignorar este e-mail: nada muda na sua conta.';
const TEMPLATES = {
  confirmation: { subject: 'Confirme seu e-mail no Aldus', html: layout({
    preheader: 'Falta só um toque para começar a ler.', title: 'Boas-vindas ao Aldus',
    intro: 'Que bom ter você por aqui. Confirme seu e-mail para ativar a conta e guardar seus livros, grifos e notas em todos os seus aparelhos.',
    action: { url: '{{ .ConfirmationURL }}', label: 'Confirmar meu e-mail' },
    why: `Você recebeu este e-mail porque alguém criou uma conta no Aldus com o endereço {{ .Email }}. ${ignore}` }) },
  recovery: { subject: 'Redefina sua senha do Aldus', html: layout({
    preheader: 'Crie uma senha nova em poucos segundos.', title: 'Vamos criar uma senha nova',
    intro: 'Recebemos um pedido para redefinir a senha da sua conta. Toque no botão abaixo e escolha uma senha nova.',
    action: { url: '{{ .ConfirmationURL }}', label: 'Criar senha nova' },
    after: 'O link vale por pouco tempo e só pode ser usado uma vez.',
    why: `Pedido feito para {{ .Email }}. ${ignore}` }) },
  magic_link: { subject: 'Seu link de acesso ao Aldus', html: layout({
    preheader: 'Entre sem digitar a senha.', title: 'Seu link de acesso',
    intro: 'Toque no botão para entrar no Aldus sem digitar a senha.',
    action: { url: '{{ .ConfirmationURL }}', label: 'Entrar no Aldus' },
    after: 'O link vale por pouco tempo e só pode ser usado uma vez.',
    why: `Pedido feito para {{ .Email }}. ${ignore}` }) },
  email_change: { subject: 'Confirme seu novo e-mail no Aldus', html: layout({
    preheader: 'Confirme a troca de e-mail da sua conta.', title: 'Confirme o novo e-mail',
    intro: 'Você pediu para trocar o e-mail da sua conta de {{ .Email }} para {{ .NewEmail }}. Confirme para concluir.',
    action: { url: '{{ .ConfirmationURL }}', label: 'Confirmar troca de e-mail' },
    why: `Se você não pediu essa troca, ignore este e-mail e considere mudar sua senha.` }) },
  invite: { subject: 'Você foi convidado para o Aldus', html: layout({
    preheader: 'Um convite para ler com o Aldus.', title: 'Você foi convidado',
    intro: 'Você recebeu um convite para usar o Aldus Reader, um leitor de EPUB e PDF para ler, grifar e estudar seus livros.',
    action: { url: '{{ .ConfirmationURL }}', label: 'Aceitar convite' },
    why: `Convite enviado para {{ .Email }}. ${ignore}` }) },
  reauthentication: { subject: 'Seu código de confirmação do Aldus', html: layout({
    preheader: 'Use este código para confirmar a ação.', title: 'Seu código de confirmação',
    intro: 'Use o código abaixo no Aldus para confirmar a alteração que você está fazendo.',
    after: `<div style="font-family:${serif};font-size:32px;letter-spacing:6px;color:${c.night};text-align:center;background:${c.cream};border-radius:10px;padding:16px 0;">{{ .Token }}</div>`,
    why: `Código para {{ .Email }}. Ele vale por pouco tempo. ${ignore}` }) },
};
module.exports = { TEMPLATES, SOCIAL };
if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, t] of Object.entries(TEMPLATES)) fs.writeFileSync(path.join(OUT, `${name}.html`), t.html);
  fs.writeFileSync(path.join(OUT, 'subjects.json'), JSON.stringify(Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, t.subject])), null, 2) + '\n');
  console.log('templates:', Object.keys(TEMPLATES).join(', '));
}
