// Drive silent renewal (owner's request, 18/11/2026: "fica desconectando e precisa reconectar a toda hora").
// Real DriveAuthorization, GoogleDriveService and platform wrapper; Google (token, Drive API, GIS, Android module) is controlled.
// Covers: renewal without a Google screen, same Google account only, legacy sources, account switch mid-renewal,
// shared renewal for concurrent callers, 401 in the middle of a traversal, Web never renews silently.
const assert = require('node:assert/strict');
const { loader } = require('./library-test-utils.cjs');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const FOLDER = 'application/vnd.google-apps.folder';

function setup({ accounts = {}, failSilent = false, listStatus = () => 200 } = {}) {
  const load = loader();
  const { DriveAuthorization } = load('src/data/drive/DriveAuthorization.ts');
  const { GoogleDriveService } = load('src/data/drive/GoogleDriveService.ts');
  const calls = [], cleared = [];
  let serial = 0, gate = null;
  const provider = {
    prepare: async () => {},
    authorize: async (_signal, _id, options = {}) => {
      calls.push({ silent: Boolean(options.silent), reconnect: Boolean(options.reconnect) });
      if (gate) await gate.promise;
      if (options.silent && failSilent) { const { DriveError } = load('src/data/drive/DriveErrors.ts'); throw new DriveError('disconnected'); }
      return { accessToken: `token-${++serial}`, expiresAt: Date.now() + 3600000 };
    },
    clearToken: async token => { cleared.push(token); },
    revoke: async () => {},
  };
  const auth = new DriveAuthorization(provider);
  const requests = [];
  const service = new GoogleDriveService(auth, async (url, options) => {
    const token = options.headers.Authorization.replace('Bearer ', '');
    requests.push({ url, token });
    if (url.includes('/about')) return json({ user: { permissionId: accounts[token] ?? 'acct-1' } });
    const u = new URL(url);
    if (u.pathname.endsWith('/folder_123456789')) return json({ id: 'folder_123456789', name: 'Livros', mimeType: FOLDER });
    const status = listStatus(token);
    if (status !== 200) return json({ error: { errors: [{ reason: 'authError' }] } }, status);
    return json({ files: [{ id: 'epub1', name: 'Dom Casmurro.epub', mimeType: 'application/epub+zip', size: '10' }] });
  });
  return { auth, service, calls, cleared, requests, setGate: g => { gate = g; } };
}
const source = (extra = {}) => ({ id: 'drive-1', name: 'Livros', kind: 'google-drive', url: 'folder_123456789', folderId: 'folder_123456789', enabled: true, status: 'active', createdAt: 1, ...extra });

(async () => {
  // 1. A source tied to an account renews without any Google screen and lists normally.
  {
    const t = setup();
    const books = await t.service.list(source({ driveAccountId: 'acct-1' }));
    assert.deepEqual(books.map(b => b.title ?? b.name ?? b.fileName).length, 1);
    assert.deepEqual(t.calls, [{ silent: true, reconnect: false }], 'one silent authorization, no screen');
    assert.equal(t.service.renewable(source({ driveAccountId: 'acct-1' })), true);
  }
  // 2. Google needs the person: silent renewal fails as disconnected and keeps nothing.
  {
    const t = setup({ failSilent: true });
    await assert.rejects(t.service.list(source({ driveAccountId: 'acct-1' })), e => e.code === 'disconnected');
    assert.equal(t.auth.connected('drive-1'), false);
  }
  // 3. Silent renewal returned another Google account: discarded, token cleared, nothing kept.
  {
    const t = setup({ accounts: { 'token-1': 'acct-other' } });
    await assert.rejects(t.service.list(source({ driveAccountId: 'acct-1' })), e => e.code === 'disconnected');
    assert.equal(t.auth.connected('drive-1'), false, 'no grant for the wrong account');
    assert.ok(t.cleared.includes('token-1'), 'the wrong token is cleared');
    assert.ok(!t.requests.some(r => r.url.includes('/files')), 'no folder read with the wrong account');
  }
  // 4. Legacy source (no account recorded): never renewed silently; the person reconnects once.
  {
    const t = setup();
    await assert.rejects(t.service.list(source()), e => e.code === 'disconnected');
    assert.deepEqual(t.calls, [], 'no authorization attempt');
    assert.equal(t.service.renewable(source()), false);
  }
  // 5. Interactive connect returns the account; a known source accepts only the same account back.
  {
    const t = setup({ accounts: { 'token-1': 'acct-1', 'token-2': 'acct-2' } });
    assert.equal(await t.service.connect(source()), 'acct-1');
    assert.deepEqual(t.calls.at(-1), { silent: false, reconnect: false }, 'first connection: account picker');
    t.auth.invalidate('drive-1');
    await assert.rejects(t.service.connect(source({ driveAccountId: 'acct-1' })), e => e.code === 'account-mismatch');
    assert.deepEqual(t.calls.at(-1), { silent: false, reconnect: true }, 'known source: reconnect mode');
    assert.equal(t.auth.connected('drive-1'), false, 'mismatched account not kept');
    assert.match(new (loader()('src/data/drive/DriveErrors.ts').DriveError)('account-mismatch').message, /outra conta Google/);
  }
  // 6. Concurrent callers share one renewal; aborting one does not cancel the other.
  {
    const t = setup(), gate = deferred(); t.setGate(gate);
    const s = source({ driveAccountId: 'acct-1' }), abort = new AbortController();
    const first = t.service.ensureAuthorized(s, abort.signal), second = t.service.ensureAuthorized(s);
    await tick(); abort.abort(); gate.resolve();
    await assert.rejects(first, e => e.name === 'AbortError' || e.code === 'cancelled' || /abort/i.test(String(e.message)));
    await second;
    assert.equal(t.calls.length, 1, 'one renewal for both callers');
    assert.equal(t.auth.connected('drive-1'), true);
  }
  // 7. Aldus account switch while a renewal waits: the late token is never kept.
  {
    const t = setup(), gate = deferred(); t.setGate(gate);
    const pending = t.service.ensureAuthorized(source({ driveAccountId: 'acct-1' }));
    await tick(); t.service.clearSession(); gate.resolve();
    await assert.rejects(pending, e => e.code === 'disconnected');
    assert.equal(t.auth.connected('drive-1'), false);
  }
  // 8. Google ends the access mid-traversal (401): renewed once silently and the traversal restarts.
  {
    const t = setup({ listStatus: token => token === 'token-1' ? 401 : 200 });
    const books = await t.service.list(source({ driveAccountId: 'acct-1' }));
    assert.equal(books.length, 1);
    assert.deepEqual(t.calls.map(c => c.silent), [true, true], 'second silent renewal after 401');
    // A legacy source is not retried: the 401 surfaces as expired.
    const legacy = setup({ listStatus: () => 401 });
    await legacy.auth.connect('drive-1');
    await assert.rejects(legacy.service.list(source()), e => e.code === 'expired');
    assert.equal(legacy.calls.length, 1, 'no silent retry without a recorded account');
  }
  // 9. Platform: the Web never renews silently and reconnects without the account picker; Android passes interactive=false.
  {
    let prompts = [], gisCalls = 0;
    global.window = { google: { accounts: { oauth2: { initTokenClient: options => { gisCalls++; return { requestAccessToken: request => { prompts.push(request.prompt); options.callback({ access_token: 'web-token', expires_in: 3600, scope: options.scope }); } }; }, revoke: () => {} } } } };
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID = 'fixture-client';
    const web = loader({ 'react-native': { Platform: { OS: 'web' } }, 'expo-modules-core': { requireOptionalNativeModule: () => null } })('src/data/drive/drivePlatformAuth.ts').drivePlatformAuth;
    await assert.rejects(web.authorize(undefined, undefined, { silent: true }), e => e.code === 'disconnected');
    assert.equal(gisCalls, 0, 'no Google window without a tap');
    await web.authorize(undefined, undefined, { reconnect: true });
    await web.authorize(undefined, undefined, {});
    assert.deepEqual(prompts, ['', 'select_account consent']);
    const flags = [];
    const android = loader({ 'react-native': { Platform: { OS: 'android' } }, 'expo-modules-core': { requireOptionalNativeModule: () => ({ authorize: async (_id, interactive) => { flags.push(interactive); return { accessToken: 'native-token', expiresAt: Date.now() + 3600000 }; }, cancelAuthorization: async () => {}, clearToken: async () => {} }) } })('src/data/drive/drivePlatformAuth.ts').drivePlatformAuth;
    await android.authorize(undefined, undefined, { silent: true });
    await android.authorize(undefined, undefined, {});
    assert.deepEqual(flags, [false, true]);
    delete global.window;
  }
  console.log('PASS Drive renewal: silent renewal without a Google screen for the same account only, wrong account discarded and cleared, legacy sources never renewed silently, interactive reconnect refuses another account, one shared renewal per source, account switch drops late tokens, 401 mid-traversal renews once, Web never renews silently and reconnects without the picker, Android passes interactive=false. Real Google account and device NOT TESTED.');
})().catch(error => { console.error(error); process.exitCode = 1; });
