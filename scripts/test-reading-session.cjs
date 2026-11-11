// Fase 2: sessão de leitura medida e "Ler em foco por X min". Domínio com relógio injetado, armazenamento por conta,
// hook real do Reader com AppState/relógio/timers controlados e atalho "Não perturbe" (só Android, intents simuladas).
// Não comprova Android físico, AppState real nem a tela de sistema do aparelho.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('require', 'exports', code)(name => {
      if (name in mocks) return mocks[name];
      if (name === 'react') return React;
      const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
      const target = ['.ts', '.tsx', ''].map(extension => base + extension).find(candidate => fs.existsSync(candidate));
      return target ? load(target) : require(name);
    }, exports);
    return exports;
  };
}

const MIN = 60000;
(async () => {
  const appStateListeners = new Set();
  const asyncStore = new Map();
  const saved = [];
  const load = loader({
    'react-native': {
      Platform: { OS: 'android' },
      AppState: { addEventListener: (_, fn) => { appStateListeners.add(fn); return { remove: () => appStateListeners.delete(fn) }; } },
      Linking: { sendIntent: async () => undefined },
    },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async key => asyncStore.get(key) ?? null, setItem: async (key, value) => { asyncStore.set(key, value); } } },
    '@/src/presentation/services/dependencies': { appDependencies: { readingSessions: { save: async (userId, record) => { saved.push({ userId, record }); return true; } } } },
  });
  const d = load('src/domain/reader/readingSession.ts');

  // Domínio: só tempo ativo; 3 min de tolerância após o último sinal; segundo plano não conta; pausa não retroage.
  let c = d.startReadingClock(0);
  assert.equal(d.activeReadingSeconds(c, 2 * MIN), 120);
  assert.equal(d.activeReadingSeconds(c, 10 * MIN), 180, 'parado: no máximo 3 min');
  assert.equal(d.readingIdle(c, 3 * MIN + 1), true);
  c = d.readingActivity(c, 10 * MIN);
  assert.equal(d.activeReadingSeconds(c, 10 * MIN), 180, 'os 7 min parados não são creditados');
  assert.equal(d.activeReadingSeconds(c, 11 * MIN), 240);
  c = d.readingBackground(c, 11 * MIN);
  assert.equal(d.activeReadingSeconds(c, 20 * MIN), 240, 'segundo plano não conta');
  assert.equal(d.readingActivity(c, 15 * MIN), c, 'virar página em segundo plano não conta');
  c = d.readingForeground(c, 20 * MIN);
  assert.equal(d.activeReadingSeconds(c, 21 * MIN), 300, 'voltar ao app retoma sem creditar o tempo fora');
  const rec = d.sessionRecord({ id: 's', bookId: 'b', format: 'epub', clock: c, now: 21 * MIN, focusGoalMinutes: 10 });
  assert.deepEqual([rec.activeSeconds, rec.focusGoalReached, rec.startedAt, rec.endedAt], [300, false, 0, 21 * MIN]);
  assert.ok(d.isReadingSessionRecord(rec));
  assert.ok(!d.isReadingSessionRecord({ ...rec, activeSeconds: 99999 }), 'tempo ativo maior que o tempo aberto é inválido');
  assert.equal(d.focusMinutesLeft(10, 300), 5); assert.equal(d.focusMinutesLeft(10, 601), 0);
  assert.equal(d.focusSummaryText(rec), 'Sessão de foco encerrada: 5 min de leitura ativa em 21 min com o livro aberto.');
  assert.equal(d.focusSummaryText({ ...rec, activeSeconds: 600, focusGoalReached: true, endedAt: 600000 }), 'Foco concluído: 10 min de leitura ativa.');
  assert.equal(d.focusSummaryText({ ...rec, activeSeconds: 20, endedAt: 20000 }), 'Sessão de foco encerrada: menos de 1 min de leitura ativa.');
  assert.doesNotMatch(fs.readFileSync('src/domain/reader/readingSession.ts', 'utf8'), /streak|ranking|sequência de dias|recorde/i);

  // Armazenamento: por conta, <10 s descartado, atualização por id, histórico ilegível preservado.
  const { ReadingSessionStore, readingSessionsKey, MAX_STORED_READING_SESSIONS } = load('src/data/local/ReadingSessionStore.ts');
  const kv = new Map(); const storage = { getItem: async k => kv.get(k) ?? null, setItem: async (k, v) => { kv.set(k, v); } };
  const store = new ReadingSessionStore(storage);
  assert.equal(await store.save('A', { ...rec, activeSeconds: 9, endedAt: 9000, startedAt: 0 }), false, 'menos de 10 s não grava');
  assert.equal(await store.save('A', rec), true);
  assert.equal(await store.save('A', { ...rec, activeSeconds: 360, endedAt: 22 * MIN }), true);
  assert.deepEqual((await store.list('A')).map(s => s.activeSeconds), [360], 'mesma sessão atualizada, não duplicada');
  assert.deepEqual(await store.list('B'), [], 'conta B não vê sessões de A');
  kv.set(readingSessionsKey('C'), '{quebrado');
  await assert.rejects(store.save('C', rec), /ilegível/); assert.equal(kv.get(readingSessionsKey('C')), '{quebrado', 'não grava por cima');
  for (let i = 0; i < MAX_STORED_READING_SESSIONS + 3; i++) await store.save('D', { ...rec, id: 'x' + i, startedAt: i * 100000, endedAt: i * 100000 + 400000 });
  const kept = await store.list('D'); assert.equal(kept.length, MAX_STORED_READING_SESSIONS); assert.equal(kept[0].id, 'x3', 'sai a mais antiga');

  // Atalho Não perturbe: só Android, sem permissão, tenta telas públicas em ordem.
  const hook = load('src/presentation/hooks/useReadingSession.ts');
  const tried = [];
  assert.equal(await hook.openSystemDoNotDisturb(async action => { tried.push(action); if (tried.length < 3) throw new Error('sem tela'); }, 'android'), true);
  assert.deepEqual(tried, [...hook.DO_NOT_DISTURB_INTENTS]);
  assert.equal(await hook.openSystemDoNotDisturb(async () => { throw new Error('x'); }, 'android'), false);
  let webCalls = 0; assert.equal(await hook.openSystemDoNotDisturb(async () => { webCalls++; }, 'web'), false); assert.equal(webCalls, 0);
  assert.ok(!fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8').includes('ACCESS_NOTIFICATION_POLICY'), 'nenhuma permissão nova');

  // Hook real: relógio e intervalos controlados.
  const { libraryAccountScope } = load('src/data/library/LibraryAccountScope.ts');
  const realNow = Date.now, realSetInterval = global.setInterval, realClearInterval = global.clearInterval;
  let now = 1_000_000; Date.now = () => now;
  const intervals = new Map(); let nextInterval = 1;
  global.setInterval = fn => { const id = nextInterval++; intervals.set(id, fn); return id; };
  global.clearInterval = id => { intervals.delete(id); };
  const tick = async () => { await act(async () => { for (const fn of [...intervals.values()]) fn(); }); };
  const setApp = async state => { await act(async () => { for (const fn of [...appStateListeners]) fn(state); }); };
  try {
    libraryAccountScope.set('user-A');
    let api; const Probe = props => { api = hook.useReadingSession(props); return null; };
    let tree; const render = async props => { await act(async () => { if (tree) tree.update(React.createElement(Probe, props)); else tree = create(React.createElement(Probe, props)); }); };
    const base = { bookId: 'book-1', format: 'epub', ready: true };
    await render({ ...base, page: 1 });
    now += MIN; await render({ ...base, page: 2 });
    now += MIN; await render({ ...base, page: 3 });
    now += 7 * MIN; await setApp('background');
    assert.equal(saved.length, 1); assert.equal(saved[0].userId, 'user-A');
    assert.equal(saved[0].record.activeSeconds, 300, '2 min virando páginas + 3 min de tolerância; o resto parado não conta');
    assert.equal(saved[0].record.focusGoalMinutes, null);
    now += 30 * MIN; await setApp('active');
    assert.equal(api.focusGoal, null); assert.equal(api.focusLeft, null, 'sem foco: nenhum número novo');

    await act(async () => api.startFocus(10));
    assert.equal(saved.length, 2, 'a sessão anterior é gravada ao começar o foco'); assert.equal(saved[1].record.id, saved[0].record.id, 'mesma sessão, atualizada');
    assert.equal(api.focusGoal, 10); assert.equal(api.focusLeft, 10);
    for (let p = 4; p < 13; p++) { now += MIN; await render({ ...base, page: p }); }
    await tick(); assert.equal(api.focusLeft, 1, 'falta 1 min de leitura ativa'); assert.equal(api.summary, null);
    now += MIN; await render({ ...base, page: 13 }); await tick();
    const focus = saved.at(-1).record;
    assert.deepEqual([focus.focusGoalMinutes, focus.focusGoalReached, focus.activeSeconds], [10, true, 600]);
    assert.notEqual(focus.id, saved[0].record.id, 'o foco é uma sessão própria');
    assert.equal(api.summary, 'Foco concluído: 10 min de leitura ativa.');
    assert.equal(api.focusGoal, null, 'meta atingida encerra o foco'); assert.equal(intervals.size, 0, 'sem relógio de foco depois de terminar');
    await act(async () => api.dismissSummary()); assert.equal(api.summary, null);

    // Resumo desligado: encerrar antes da meta grava, sem resumo; preferência fica no aparelho.
    await act(async () => api.setFocusSummaryEnabled(false)); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(asyncStore.get(hook.FOCUS_SUMMARY_KEY), 'false');
    await act(async () => api.startFocus(25)); now += 2 * MIN; await render({ ...base, page: 14 });
    await act(async () => api.endFocus());
    const early = saved.at(-1).record; assert.deepEqual([early.focusGoalMinutes, early.focusGoalReached], [25, false]); assert.equal(api.summary, null);
    await act(async () => api.startFocus(null)); assert.equal(api.focusGoal, null, '"Ler em foco" sem tempo só esconde os controles');

    // Conta trocada no meio: nada é gravado ao sair.
    const before = saved.length; now += 2 * MIN; await render({ ...base, page: 15 });
    libraryAccountScope.set('user-B'); await act(async () => tree.unmount());
    assert.equal(saved.length, before, 'sessão de A não vai para B');
    // Sem conta: mede para o foco, mas não grava.
    libraryAccountScope.set(null); tree = null; await render({ ...base, page: 1 }); now += 2 * MIN; await render({ ...base, page: 2 });
    await act(async () => tree.unmount()); assert.equal(saved.length, before);
  } finally {
    Date.now = realNow; global.setInterval = realSetInterval; global.clearInterval = realClearInterval;
  }

  // Integração: Reader mede EPUB/PDF/Leitura Livre pela página exibida; os minutos do foco seguem "Ocultar porcentagem e páginas".
  const screen = fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8');
  assert.match(screen, /useReadingSession\(\{ bookId, format: isReflowPdf \? "reflow" : isPdf \? "pdf" : "epub", ready: bookStatus === "ready", page: pageNumber \}\)/);
  assert.match(screen, /onOpenDoNotDisturb=\{Platform\.OS === "android" \?/);
  assert.match(screen, /hideReadingCounts: settings\.hideReadingCounts,\s*timeLeftLabel: \[timeLeftLabel, focusLabel\]/);
  console.log('PASS reading session: tempo ativo (3 min de inatividade, segundo plano), foco 10/15/25/45 por tempo ativo, resumo desligável, gravação por conta (A≠B, sem conta não grava, <10 s descartado, ilegível preservado), Não perturbe só Android sem permissão. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
