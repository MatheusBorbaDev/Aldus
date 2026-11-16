// Configuração de plataforma ligada à segurança (verificação de 12–15/11/2026): permissões do Android, cabeçalhos da Web e o
// que não pode entrar no repositório. Lê arquivos; não compila, não publica e não comprova o comportamento do Vercel ou do aparelho.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');

// Android: "sobrepor a outros apps" removido do release (o build de depuração mantém para o menu do desenvolvedor).
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
assert.match(manifest, /<uses-permission android:name="android\.permission\.SYSTEM_ALERT_WINDOW" tools:node="remove"\/>/);
assert.match(manifest, /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/);
assert.match(fs.readFileSync('android/app/src/debug/AndroidManifest.xml', 'utf8'), /SYSTEM_ALERT_WINDOW/, 'depuração continua com o menu do desenvolvedor');
assert.doesNotMatch(manifest, /usesCleartextTraffic="true"/, 'release sem tráfego HTTP sem criptografia');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo.android;
assert.deepEqual(app.blockedPermissions, ['android.permission.SYSTEM_ALERT_WINDOW'], 'app.json espelha o manifesto');
assert.ok(!(app.permissions ?? []).includes('android.permission.SYSTEM_ALERT_WINDOW'));

// Backup desligado (decisão do dono, 16/11/2026): sessão de login e biblioteca local fora do backup na nuvem e da transferência
// entre aparelhos. allowBackup="false" vale abaixo do SDK 31; no SDK 31+ a transferência direta exige dataExtractionRules.
assert.match(manifest, /android:allowBackup="false"/);
assert.match(manifest, /android:fullBackupContent="false"/);
assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
assert.match(manifest, /tools:replace="android:allowBackup"/, 'biblioteca que declare allowBackup não religa o backup');
assert.equal(app.allowBackup, false, 'app.json espelha o manifesto');
const rules = fs.readFileSync('android/app/src/main/res/xml/data_extraction_rules.xml', 'utf8');
const domains = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];
for (const section of ['cloud-backup', 'device-transfer']) {
  const body = rules.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`))?.[1] ?? '';
  assert.ok(body, section);
  assert.doesNotMatch(body, /<include\b/, `${section}: nada incluído`);
  for (const domain of domains) assert.match(body, new RegExp(`<exclude domain="${domain}" path="\\." />`), `${section}: ${domain} excluído`);
}

// Web: não pode ser exibido dentro de outro site e não pede recursos sensíveis do navegador.
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const all = vercel.headers.find(rule => rule.source === '/(.*)').headers;
const header = key => all.find(h => h.key === key)?.value;
assert.equal(header('X-Content-Type-Options'), 'nosniff');
assert.equal(header('Referrer-Policy'), 'strict-origin-when-cross-origin');
assert.equal(header('X-Frame-Options'), 'DENY');
for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) assert.ok(header('Permissions-Policy').includes(feature), feature);

// Repositório: nenhum arquivo de ambiente ou chave privada versionado; só a chave de ensaio documentada.
const tracked = cp.execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
assert.deepEqual(tracked.filter(file => /(^|\/)\.env(\.|$)|\.(jks|keystore|p12|pem|key)$/i.test(file)), ['android/app/debug.keystore']);
const gitignore = fs.readFileSync('.gitignore', 'utf8');
for (const rule of ['.env*', '*.jks', '*.keystore']) assert.ok(gitignore.includes(rule), rule);
console.log('PASS platform security: release sem SYSTEM_ALERT_WINDOW e sem backup do Android (nuvem e transferência entre aparelhos; app.json espelhado), sem HTTP sem criptografia, Web com X-Frame-Options DENY e Permissions-Policy, nenhum .env ou chave privada versionado além da chave de ensaio. Sem build nem deploy.');
