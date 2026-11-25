// Modelos de e-mail do Supabase Auth (25/11/2026): pt-BR, variáveis certas, nada externo além da medalha do próprio site.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { TEMPLATES, SOCIAL } = require('./write-email-templates.cjs');
const needs = { confirmation: ['{{ .ConfirmationURL }}'], recovery: ['{{ .ConfirmationURL }}'], magic_link: ['{{ .ConfirmationURL }}'],
  email_change: ['{{ .ConfirmationURL }}', '{{ .NewEmail }}'], invite: ['{{ .ConfirmationURL }}'], reauthentication: ['{{ .Token }}'] };
assert.deepEqual(Object.keys(TEMPLATES).sort(), Object.keys(needs).sort());
for (const [name, t] of Object.entries(TEMPLATES)) {
  for (const variable of needs[name]) assert.ok(t.html.includes(variable), `${name}: ${variable}`);
  assert.match(t.html, /<html lang="pt-BR">/); assert.match(t.subject, /Aldus/);
  assert.doesNotMatch(t.html, /<script|<link |@import|javascript:/i, `${name}: no scripts or external styles`);
  const urls = [...t.html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.every(u => u.startsWith('https://aldusreader.com.br') || SOCIAL.some(([, , url]) => u === url) || u.startsWith('mailto:suporte@aldusreader.com.br') || u.startsWith('{{ .')), `${name}: ${urls}`);
  assert.equal(fs.readFileSync(path.join('supabase', 'templates', `${name}.html`), 'utf8'), t.html, `${name}: generated file is current`);
}
assert.ok(fs.statSync('public/email/aldus-medalha.png').size > 1000, 'medal image is published with the site');
// 25/11/2026: social icons in every email and the beta invite, same profiles as the landing (src/marketing/socialLinks.tsx).
const landing = fs.readFileSync('src/marketing/socialLinks.tsx', 'utf8');
for (const [id, , url] of SOCIAL) {
  assert.ok(landing.includes(`url: "${url}"`), `landing has ${url}`);
  assert.ok(fs.statSync(`public/email/social-${id}.png`).size > 100, `icon ${id}`);
  for (const t of Object.values(TEMPLATES)) assert.ok(t.html.includes(url) && t.html.includes(`social-${id}.png`), id);
  const invite = fs.readFileSync('marketing/emails/convite-beta.html', 'utf8'); assert.ok(invite.includes(url) && invite.includes(`social-${id}.png`), `invite ${id}`);
}
assert.match(fs.readFileSync('src/marketing/LandingDocument.tsx', 'utf8'), /<SocialLinks\/>/);
console.log('PASS email templates: six pt-BR Supabase Auth templates with the right variables, no scripts, only aldusreader.com.br links and the site medal, generated files current.');
