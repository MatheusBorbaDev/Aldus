// Auth entry screens in the exported Web app (quality wave 4): login, signup, password recovery/reset and complete-profile.
// Visual matrix 320/390/768/1440 x light/dark x normal/enlarged text, no horizontal overflow, interactive targets >= 44 px,
// local validation errors announced as alerts. Supabase identity is a fixture; every non-local request is blocked, nothing is
// submitted to a real server. Enlarged text is a synthetic Web approximation (computed font size x1.3), not Android fontScale.
// Usage: node scripts/test-auth-ui-web.cjs [--report-only] [--out <dir>]   (--report-only lists violations without failing).
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process'), http = require('node:http');
const wait = ms => new Promise(r => setTimeout(r, ms));
const reportOnly = process.argv.includes('--report-only');
const outArg = process.argv.indexOf('--out');
async function cdp(url) {
  const socket = new WebSocket(url); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const pending = new Map(); let nextId = 0;
  socket.addEventListener('message', e => { const message = JSON.parse(e.data), p = pending.get(message.id); if (!p) return; pending.delete(message.id); message.error ? p.reject(Error(message.error.message)) : p.resolve(message.result); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  return { command, close: () => socket.close(), evaluate: async expression => { const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; } };
}
(async () => {
  const exported = path.resolve('dist'), bundleFile = fs.readdirSync(path.join(exported, '_expo/static/js/web')).find(name => name.startsWith('entry-'));
  const project = fs.readFileSync(path.join(exported, '_expo/static/js/web', bundleFile), 'utf8').match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  assert.ok(project, 'Export must include public Supabase configuration for the controlled session fixture.');
  const chrome = process.env.SOURCE_LIBRARY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-auth-ui-'));
  const screenshots = path.resolve(outArg > 0 ? process.argv[outArg + 1] : '.expo/auth-ui-validation'); fs.mkdirSync(screenshots, { recursive: true });
  const server = http.createServer((req, res) => {
    let target = path.resolve(exported, '.' + decodeURIComponent(new URL(req.url, 'http://fixture.local').pathname));
    if (!target.startsWith(exported + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(exported, 'index.html');
    const type = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.css': 'text/css' }[path.extname(target)] ?? 'application/octet-stream';
    res.setHeader('Content-Type', type); fs.createReadStream(target).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const child = cp.spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--window-size=430,900', `--user-data-dir=${profileDirectory}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let client; const violations = [];
  try {
    let port; for (let i = 0; i < 80; i++) { const file = path.join(profileDirectory, 'DevToolsActivePort'); if (fs.existsSync(file)) { port = fs.readFileSync(file, 'utf8').split('\n')[0]; break; } await wait(100); }
    assert.ok(port, 'Chrome CDP startup'); const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); client = await cdp(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    const user = { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: '2026-11-09T00:00:00Z' };
    const jwt = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url'), 'fixture-signature'].join('.');
    const session = { access_token: jwt, refresh_token: 'fixture-not-real', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user };
    await client.command('Page.enable'); await client.command('Runtime.enable');
    // `fixture-session` in sessionStorage turns the signed-in fixture (profile without username) on for complete-profile only.
    await client.command('Page.addScriptToEvaluateOnNewDocument', { source: `
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/auth/v1/user')) return Promise.resolve(new Response(${JSON.stringify(JSON.stringify(user))}, { headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('/rest/v1/profiles')) return Promise.resolve(new Response(JSON.stringify({ id: ${JSON.stringify(user.id)}, username: null, display_name: null, avatar_url: null, role: 'user', account_status: 'active' }), { headers: { 'Content-Type': 'application/json' } }));
        if (/^https?:/.test(url) && !url.startsWith(${JSON.stringify(origin)})) return Promise.reject(Error('External requests blocked in controlled fixture'));
        return originalFetch(input, options);
      };
      if (location.origin === ${JSON.stringify(origin)}) {
      const key = 'sb-${project[1]}-auth-token';
      if (sessionStorage.getItem('fixture-session') === '1') localStorage.setItem(key, ${JSON.stringify(JSON.stringify(session))}); else localStorage.removeItem(key);
      }
    ` });
    const text = () => client.evaluate("document.body?.innerText ?? ''");
    const until = async (snippet, timeout = 15000) => { const start = Date.now(); while (Date.now() - start < timeout) { if ((await text()).includes(snippet)) return; await wait(100); } throw Error(`Missing UI: ${snippet}; ` + (await text()).slice(0, 600)); };
    const navigate = async route => { await client.command('Page.navigate', { url: origin + route }); await wait(700); };
    const screenshot = async name => { const r = await client.command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(screenshots, name + '.png'), Buffer.from(r.data, 'base64')); };
    const enlargeText = () => client.evaluate(`(() => { for (const e of document.querySelectorAll('body *')) { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const s = getComputedStyle(e), size = parseFloat(s.fontSize), line = parseFloat(s.lineHeight); e.style.fontSize = (size * 1.3) + 'px'; if (line) e.style.lineHeight = (line * 1.3) + 'px'; } })()`);
    // Visible buttons/links/inputs smaller than 44 px in either dimension (inputs: height only).
    const smallTargets = () => client.evaluate(`[...document.querySelectorAll('[role=button],[role=link],a,input')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; return e.tagName === 'INPUT' ? r.height < 43.5 : (r.height < 43.5 || r.width < 43.5); }).map(e => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))`);
    const check = (condition, message) => { if (!condition) { violations.push(message); if (!reportOnly) assert.fail(message); } };
    const screens = [
      ['/auth/login', 'Entrar para continuar', 'login', false, 'Bem-vindo'],
      ['/auth/signup', 'Criar conta', 'signup', false, 'Sua biblioteca local'],
      ['/auth/forgot-password', 'Recuperar senha', 'forgot', false, 'link de recuperação'],
      ['/auth/reset-password', 'Redefinir senha', 'reset', false, 'nova senha'],
      ['/auth/complete-profile', 'Escolha seu nome de usuário', 'profile', true, 'Escolha seu nome de usuário'],
    ];
    await navigate('/auth/login');
    for (const [route, , name, signedIn, ready] of screens) {
      for (const theme of ['light', 'dark']) {
        for (const width of [320, 390, 768, 1440]) {
          await client.command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          for (const large of [false, true]) {
            await client.evaluate(`sessionStorage.setItem('fixture-session', ${JSON.stringify(signedIn ? '1' : '0')}); localStorage.setItem('@kindle/appTheme', ${JSON.stringify(theme)})`);
            await navigate(route); await until(ready); await wait(200); if (large) { await enlargeText(); await wait(150); }
            const label = `${name} ${theme} ${width}${large ? ' text130' : ''}`;
            check(!(await client.evaluate('document.documentElement.scrollWidth>innerWidth')), `${label}: horizontal overflow`);
            if (!large) { const small = await smallTargets(); check(small.length === 0, `${label}: targets under 44 px: ${small.join('; ')}`); }
            await screenshot(`${name}-${theme}-${width}${large ? '-text130' : ''}`);
          }
        }
      }
    }
    await client.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.evaluate(`sessionStorage.setItem('fixture-session','0'); localStorage.setItem('@kindle/appTheme','light')`);
    const press = async label => { const ok = await client.evaluate(`(() => { const e = [...document.querySelectorAll('[role=button]')].find(e => (e.getAttribute('aria-label') === ${JSON.stringify(label)} || e.textContent.trim() === ${JSON.stringify(label)})); e?.click(); return !!e; })()`); assert.ok(ok, 'missing button ' + label); await wait(300); };
    const type = async (label, value) => { await client.evaluate(`(() => { const e = document.querySelector('input[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`); await wait(100); };
    // Local validation errors only (no request leaves the page): empty login, password mismatch on signup.
    await navigate('/auth/login'); await until('Bem-vindo'); await press('Entrar'); await until('Informe usuário ou email e senha.');
    check(await client.evaluate(`[...document.querySelectorAll('[role=alert]')].some(e => e.textContent.includes('Informe usuário ou email e senha.'))`), 'login error is an alert');
    await screenshot('login-error');
    await navigate('/auth/signup'); await until('Sua biblioteca local'); await type('Nome', 'Leitor'); await type('Nome de usuário', 'Leitor Teste'); await type('Email', 'leitor@example.invalid'); await type('Senha', 'abcdefgh'); await type('Confirmar senha', 'abcdefgx'); await press('Criar conta'); await until('Confirmar senha: as duas senhas não são iguais.'); await until('Confira o campo marcado em vermelho.');
    check(await client.evaluate(`[...document.querySelectorAll('[role=alert]')].some(e => e.textContent.includes('Confirmar senha: as duas senhas não são iguais.')) && [...document.querySelectorAll('[aria-invalid=true]')].length === 1`), 'signup error is an alert under its field, only that field marked');
    await screenshot('signup-error');
    await client.evaluate(`localStorage.setItem('@kindle/appTheme','dark')`); await navigate('/auth/login'); await until('Bem-vindo'); await press('Entrar'); await until('Informe usuário ou email e senha.'); await screenshot('login-error-dark');
    if (violations.length) console.log(`REPORT ${violations.length} violation(s):\n- ` + violations.join('\n- '));
    console.log(`${violations.length && reportOnly ? 'REPORT-ONLY' : 'PASS'} exported Web auth screens: login/signup/forgot/reset/complete-profile x 320/390/768/1440 x light/dark x normal/enlarged (synthetic x1.3) = 80 captures + local error states; overflow and 44 px targets checked. Screenshots ${path.relative(process.cwd(), screenshots)}. Supabase fixture only; no real sign-in; Android NOT TESTED.`);
  } finally {
    client?.close(); const exited = new Promise(r => child.once('exit', r)); child.kill(); await Promise.race([exited, wait(2000)]); await new Promise(r => server.close(r));
    if (path.dirname(fs.realpathSync(profileDirectory)).toLowerCase() === fs.realpathSync(os.tmpdir()).toLowerCase() && path.basename(profileDirectory).startsWith('aldus-auth-ui-')) {
      try { fs.rmSync(profileDirectory, { recursive: true, maxRetries: 5, retryDelay: 100 }); } catch { console.warn('Temporary controlled Chrome profile could not be removed.'); }
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
