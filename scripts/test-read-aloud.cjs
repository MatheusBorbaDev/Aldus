// Onda C1: leitura em voz alta. Funções puras + hook real com expo-speech controlado. Não prova a voz do Android.
const assert = require('node:assert/strict');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const spoken = []; let stops = 0;
const speech = { speak: (text, options) => spoken.push({ text, options }), stop: async () => { stops++; } };
const load = require('./community-test-loader.cjs')({ react: React, 'expo-speech': speech });
const t = load('src/domain/reader/speechText.ts');
// HTML → text.
assert.equal(t.htmlToSpeechText('<html><head><title>x</title><style>p{}</style></head><body><h1>Capítulo I</h1><p>Olá,&nbsp;mundo &amp; leitor.</p><p>Fim&#33;</p></body></html>'), 'Capítulo I\nOlá, mundo & leitor.\nFim!');
// Start offset: proportional, then the next sentence.
const text = 'Primeira frase. Segunda frase. Terceira frase. Quarta frase.';
assert.equal(t.speechStartOffset(text, 10, 10, 14), 0, 'first page of the chapter starts at the beginning');
const offset = t.speechStartOffset(text, 12, 10, 14); assert.equal(text.slice(offset), 'Terceira frase. Quarta frase.', 'half-way → next sentence start');
assert.equal(t.speechStartOffset('', 3, 1, 5), 0);
// Chunks: sentence boundaries, max length, long sentences split.
assert.deepEqual(t.splitForSpeech('A b. C d. E f.', 10), ['A b. C d.', 'E f.']);
assert.ok(t.splitForSpeech('x'.repeat(7000), 3000).every(chunk => chunk.length <= 3000));
assert.deepEqual(t.splitForSpeech('   '), []);
// Hook.
const { useReadAloud } = load('src/presentation/hooks/useReadAloud.ts');
let api; function Probe() { api = useReadAloud(); return null; }
const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
(async () => {
  let tree; await act(async () => { tree = create(React.createElement(Probe)); });
  await act(async () => api.start('Um. Dois.', 'pt-BR')); await flush();
  assert.equal(api.speaking, true); assert.equal(spoken.length, 1); assert.equal(spoken[0].options.language, 'pt-BR');
  await act(async () => spoken[0].options.onDone()); await flush();
  assert.equal(api.speaking, false, 'one short chunk → done after it');
  spoken.length = 0; await act(async () => api.start('x'.repeat(5000), null)); await flush();
  assert.equal(spoken.length, 1); assert.equal(spoken[0].options.language, undefined, 'no declared language → system voice language');
  await act(async () => spoken[0].options.onDone()); await flush(); assert.equal(spoken.length, 2, 'next chunk follows');
  const stale = spoken[1].options; await act(async () => api.stop()); await flush();
  assert.equal(api.speaking, false); await act(async () => stale.onDone()); await flush(); assert.equal(spoken.length, 2, 'stopped reading does not continue');
  spoken.length = 0; await act(async () => api.start('Um.', null)); await flush(); const first = spoken[0].options;
  await act(async () => api.start('Dois.', null)); await flush(); await act(async () => first.onDone()); await flush();
  assert.deepEqual(spoken.map(s => s.text), ['Um.', 'Dois.'], 'a new reading cancels the previous sequence');
  await act(async () => spoken[1].options.onError()); await flush(); assert.match(api.error, /não conseguiu ler/);
  await act(async () => api.start('', null)); assert.match(api.error, /Não há texto/);
  const before = stops; await act(async () => tree.unmount()); await flush(); assert.ok(stops > before, 'leaving the reader stops speech');
  console.log('PASS read aloud: HTML→text with entities, proportional start at the beginning of its sentence, ≤3000-char sentence chunks; hook sequences, stops, cancels stale sequences, reports errors, stops on unmount. Android voice NOT TESTED.');
})().catch(e => { console.error(e); process.exitCode = 1; });
