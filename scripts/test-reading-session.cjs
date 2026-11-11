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

  console.log('PASS reading session (domínio e armazenamento): tempo ativo com 3 min de inatividade e segundo plano, registro validado, gravação por conta (A≠B, <10 s descartado, ilegível preservado). Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
