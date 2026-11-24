// A lista de entrega (scripts/verify-release-features.cjs) acompanha o código e detecta recurso faltando num pacote gerado.
// Pedido do dono em 16/11/2026: nenhum APK ou site sai sem tudo o que foi pedido. Não compila nem abre APK.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const { FEATURES, checkBundle, has } = require('./verify-release-features.cjs');

// 1. Todos os marcadores existem no código e todas as rotas existem.
const source = cp.spawnSync(process.execPath, ['scripts/verify-release-features.cjs', '--source'], { encoding: 'utf8' });
assert.equal(source.status, 0, source.stderr || source.stdout);

// 2. Itens que o dono pediu explicitamente e que já faltaram ou quase faltaram numa entrega.
const ids = FEATURES.map(feature => feature.id);
for (const required of ['community-tab', 'community-people', 'community-server', 'reader-focus', 'reader-milestones', 'reader-legible-font', 'import-duplicate', 'import-reattach', 'reader-security', 'legal-antipiracy'])
  assert.ok(ids.includes(required), required);
assert.equal(new Set(ids).size, ids.length, 'ids únicos');
for (const feature of FEATURES) assert.ok(feature.pedido && (feature.markers.length || feature.androidMarkers?.length || feature.webMarkers?.length), feature.id);

// 3. Um pacote sem um recurso é recusado; texto acentuado é reconhecido nas codificações do Hermes e do JS minificado.
const everything = FEATURES.flatMap(feature => [...feature.markers, ...(feature.androidMarkers ?? []), ...(feature.webMarkers ?? []), ...(feature.routes ?? []).map(route => `./${route}.tsx`)]);
const complete = Buffer.from(everything.join('\n'), 'utf8');
assert.deepEqual(checkBundle(complete, 'teste', true), []);
const withoutPeople = Buffer.from(everything.filter(marker => marker !== 'Encontrar leitores').join('\n'), 'utf8');
assert.match(checkBundle(withoutPeople, 'teste', true).join('\n'), /community-people .*Encontrar leitores/);
const withoutTab = Buffer.from(everything.filter(marker => marker !== './(tabs)/community.tsx').join('\n'), 'utf8');
assert.match(checkBundle(withoutTab, 'teste', true).join('\n'), /community-tab .*rota \(tabs\)\/community/);
assert.deepEqual(checkBundle(Buffer.from(everything.filter(marker => marker !== 'isEvalSupported').join('\n'), 'utf8'), 'teste', false), [], 'marcador só do Android não é exigido no site');
const withoutNativeHash = Buffer.from(everything.filter(marker => marker !== 'AldusFileHash').join('\n'), 'utf8');
assert.deepEqual(checkBundle(withoutNativeHash, 'teste', false), [], 'item só do Android (módulo nativo) não é exigido no site');
assert.match(checkBundle(withoutNativeHash, 'teste', true).join('\n'), /native-file-hash/, 'mas é exigido no APK');
// A landing pública (rota .web.tsx) só existe no site: marcador só da Web é exigido no dist/ e nunca no APK (23/11/2026).
const withoutLanding = Buffer.from(everything.filter(marker => marker !== 'Pular abertura').join('\n'), 'utf8');
assert.match(checkBundle(withoutLanding, 'teste', false).join('\n'), /landing-press-opening .*Pular abertura/, 'abertura exigida no site');
assert.deepEqual(checkBundle(withoutLanding, 'teste', true), [], 'mas não no APK');
assert.ok(has(Buffer.from('Pedidos para seguir voc\\xea', 'utf8'), 'Pedidos para seguir você'), 'JS minificado com \\x');
assert.ok(has(Buffer.from('Pedidos para seguir voc\\u00ea', 'utf8'), 'Pedidos para seguir você'), 'JS minificado com \\u');
assert.ok(has(Buffer.from('Pedidos para seguir você', 'utf16le'), 'Pedidos para seguir você'), 'Hermes em UTF-16');
assert.ok(!has(Buffer.from('Pedidos para seguir voce', 'utf8'), 'Pedidos para seguir você'), 'sem acento não conta');

for (const required of ['default-cover', 'drive-quiet-header', 'build-revision', 'library-catalog-offer']) assert.ok(ids.includes(required), required);
// O ícone da marca é conferido no APK (recurso, não texto): adaptativo, monocromático e fundo azul-noite. Testado contra o APK 79ad0a2
// (ícone antigo: recusado) e o d44a911 (aceito) em 19/11; aqui só se garante que a checagem continua no script.
assert.match(fs.readFileSync('scripts/verify-release-features.cjs', 'utf8'), /iconBackground: t=0x1d d=0xff1b1c30[\s\S]*brand-icon/);

// 4. O comando de compilar limpa os recursos antigos e não termina com sucesso sem a checagem.
const build = fs.readFileSync('scripts/build-apk-local.mjs', 'utf8');
assert.match(build, /rmSync\(path\.join\(androidDir, "app\/build\/generated\/res\/react\/release"\)/);
assert.ok(build.indexOf('rmSync(') > 0 && build.indexOf('rmSync(') < build.indexOf('const result = spawnSync('), 'limpa antes do Gradle');
assert.match(build, /verify-release-features\.cjs"\), "--apk", apkPath\]/);
assert.match(build, /if \(features\.status !== 0\) \{[\s\S]*process\.exit\(1\);/);
console.log(`PASS release features: ${FEATURES.length} recursos pedidos com marcadores no código; pacote sem um deles é recusado (inclusive a aba e as telas da Comunidade); acentos em UTF-16 e escapes de JS; build do APK limpa recursos antigos e roda a checagem.`);
