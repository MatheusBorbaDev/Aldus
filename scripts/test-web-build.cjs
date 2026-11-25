const assert = require('node:assert/strict'), fs = require('node:fs');
const { validate } = require('./validate-web-env.cjs');
const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://ci-fixture.supabase.co', EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_fixture' };
validate(env); validate({});
for (const bad of [{ VERCEL: '1' }, { EXPO_PUBLIC_PASSWORD: 'never' }, { ...env, EXPO_PUBLIC_SUPABASE_KEY: 'sb_secret_canary' }, { ...env, EXPO_PUBLIC_SERVICE_ROLE: 'never' },
  { ...env, EXPO_PUBLIC_SUPABASE_KEY: `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature` },
  { ...env, EXPO_PUBLIC_SUPABASE_URL: 'http://insecure.invalid' }, { ...env, VERCEL_ENV: 'production' }]) assert.throws(() => validate(bad));
validate({ ...env, VERCEL_ENV: 'production', EXPO_PUBLIC_LEGAL_CONTROLLER_NAME: 'Verified fixture', EXPO_PUBLIC_LEGAL_CONTACT_EMAIL: 'legal@example.invalid' });
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const workflow = require('yaml').parse(fs.readFileSync('.github/workflows/validate.yml', 'utf8'));
assert.deepEqual(workflow.permissions, { contents: 'read' });
assert.ok(workflow.on.pull_request !== undefined && workflow.on.push);
assert.ok(!('pull_request_target' in workflow.on));
for (const step of workflow.jobs.validate.steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
assert.doesNotMatch(JSON.stringify(workflow), /secrets\.|vercel deploy|--prod/);
assert.equal(config.outputDirectory, 'dist'); assert.equal(config.buildCommand, 'npm run build');
assert.equal(config.framework, null); assert.ok(config.headers.some(rule => rule.source === '/build-info.json' && rule.headers.some(h => h.key === 'Cache-Control' && h.value === 'no-store')));
assert.ok(config.rewrites.some(rule => rule.destination === '/index.html'));
assert.ok(config.rewrites.some(rule => rule.source === '/' && rule.destination === '/index.html'));
// With cleanUrls, Vercel serves app.html at /app and redirects /app.html, so a rewrite to "/app.html" found nothing and every app route
// answered 404 in production (seen on 19/11/2026). The fallback must point at the clean path.
assert.equal(config.cleanUrls, true);
assert.ok(config.rewrites.some(rule => rule.source === '/(.*)' && rule.destination === '/app'), 'SPA fallback uses the clean /app path');
assert.ok(!config.rewrites.some(rule => rule.source !== '/' && /\.html$/.test(rule.destination)), 'no .html rewrite target under cleanUrls');
assert.ok(!JSON.stringify(config).includes('unsafe-inline'));
// Cloudflare (25/11/2026): mesma checagem de produção pelo Workers Builds; prévia de outra branch não exige identidade legal.
assert.throws(() => validate({ ...env, WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }), 'produção na Cloudflare exige controlador e contato');
validate({ ...env, WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main', EXPO_PUBLIC_LEGAL_CONTROLLER_NAME: 'Verified fixture', EXPO_PUBLIC_LEGAL_CONTACT_EMAIL: 'legal@example.invalid' });
validate({ ...env, WORKERS_CI: '1', WORKERS_CI_BRANCH: 'preview-x' });
assert.throws(() => validate({ WORKERS_CI: '1' }), 'build na Cloudflare sem Supabase falha');
// Site estático na Cloudflare: Worker sem script, só a pasta dist; nada de segredo na configuração versionada.
const wrangler = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
assert.equal(wrangler.assets.directory, './dist'); assert.ok(!('main' in wrangler), 'sem script de Worker');
assert.ok(!('vars' in wrangler) && !/token|secret|key/i.test(JSON.stringify(wrangler)), 'variáveis ficam no painel');
const { appRouteSegments, cloudflareFiles } = require('./write-cloudflare-assets.cjs');
const segments = appRouteSegments();
for (const route of ['library', 'reader', 'auth', 'legal', 'beta', 'community', 'catalog']) assert.ok(segments.includes(route), route);
assert.ok(!segments.some(segment => /^(index|_layout|\(tabs\)|\+native-intent)$/.test(segment)), 'landing e layouts não viram regra');
const cf = cloudflareFiles({ vercelConfig: config, segments, distEntries: ['index.html', 'app.html', '_expo', 'assets', 'fonts'] });
assert.match(cf.redirects, /^\/reader\/\* \/app 200$/m); assert.match(cf.redirects, /^\/library \/app 200$/m);
assert.doesNotMatch(cf.redirects, /^\/ |^\/\* /m, 'a landing e os arquivos do export não são reescritos');
assert.ok(cf.redirects.indexOf('/library /app') < cf.redirects.indexOf('/library/* /app'), 'regras estáticas antes das dinâmicas');
for (const rule of config.headers) for (const h of rule.headers) assert.ok(cf.headers.includes(`  ${h.key}: ${h.value}`), h.key);
assert.match(cf.headers, /^\/build-info\.json\n  Cache-Control: no-store$/m); assert.match(cf.headers, /^\/\*\n  X-Content-Type-Options: nosniff$/m);
assert.throws(() => cloudflareFiles({ vercelConfig: config, segments: ['fonts'], distEntries: ['fonts'] }), 'rota com nome de pasta do export');
if (process.argv.includes('--exported')) {
  for (const file of ['_headers', '_redirects', '.assetsignore']) assert.ok(fs.existsSync(`dist/${file}`), file);
  const metadata = JSON.parse(fs.readFileSync('dist/build-info.json', 'utf8'));
  assert.match(metadata.commit, /^[a-f0-9]{40}$/); assert.match(metadata.contentSha256, /^[a-f0-9]{64}$/);
  assert.ok(metadata.webFiles > 0); assert.doesNotMatch(JSON.stringify(metadata), /token|secret|apikey|supabase/i);
  assert.ok(fs.existsSync('dist/index.html'));
  const path = require('node:path'), crypto = require('node:crypto'), files = [];
  const walk = directory => { for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name); if (item.isDirectory()) walk(file);
    else if (item.isFile() && /\.(js|html|css)$/.test(item.name)) files.push(path.relative('dist', file).replaceAll('\\', '/'));
  } };
  walk('dist'); files.sort(); const hash = crypto.createHash('sha256');
  for (const file of files) { hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(path.join('dist', file))); }
  assert.equal(metadata.contentSha256, hash.digest('hex')); assert.equal(metadata.webFiles, files.length);
}
console.log('PASS Web build: public environment rejects secrets, explicit static target, SPA routing and traceability contract' + (process.argv.includes('--exported') ? ', exported metadata verified' : '') + '. No production deploy.');
