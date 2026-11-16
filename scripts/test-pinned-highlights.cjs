// FASE 3, A1: trechos fixados. Ordem (fixados primeiro), réplica do Sync (outro aparelho recebe a marca; payload antigo vale
// como não fixado) e o painel (marca "Fixado", ação no menu, edição preserva a marca). Sem aparelho nem servidor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./community-test-loader.cjs')({ 'react-native': { Platform: { OS: 'android' } } });

const { orderHighlights, isPinned, withPinned } = load('src/domain/study/pinnedHighlights.ts');
const h = (id, createdAt, extra = {}) => ({ id, bookId: 'b', chapterId: 'c', startCfi: 's', endCfi: 's', highlightedText: id, colorLabel: 'yellow', createdAt, ...extra });
assert.deepEqual(orderHighlights([h('velho', 1), h('fixado-antigo', 2, { pinned: true }), h('novo', 9), h('fixado-novo', 5, { pinned: true })]).map(x => x.id),
  ['fixado-novo', 'fixado-antigo', 'novo', 'velho']);
assert.equal(isPinned(h('a', 1)), false, 'ausente = não fixado');
assert.equal(isPinned(h('a', 1, { pinned: 'sim' })), false, 'só true conta');
assert.deepEqual(withPinned(h('a', 1), true), { ...h('a', 1), pinned: true });

// Réplica: o grifo chega de outro aparelho com e sem a marca.
(async () => {
  const { LibraryLocalReplica } = load('src/data/library/LibraryLocalReplica.ts');
  const { libraryAccountScope } = load('src/data/library/LibraryAccountScope.ts');
  const A = '11111111-1111-4111-8111-111111111111';
  libraryAccountScope.set(A);
  const book = { id: 'b', ownerUserId: A, isDeleted: false, importComplete: true };
  const saved = new Map();
  const highlights = { findById: async id => saved.get(id) ?? null, save: async item => { saved.set(item.id, item); }, remove: async id => { saved.delete(id); } };
  const replica = new LibraryLocalReplica({ listAll: async () => [book], save: async () => undefined }, {}, {}, highlights, {}, {});
  const entry = (id, payload) => ({ kind: 'highlight', id, bookId: 'b', deleted: false, payload: { chapterId: 'c', startCfi: 's', endCfi: 's', highlightedText: 't', colorLabel: 'blue', createdAt: 3, ...payload } });
  await replica.apply(A, entry('remoto-fixado', { pinned: true }));
  await replica.apply(A, entry('remoto-antigo', {}));
  await replica.apply(A, entry('remoto-invalido', { pinned: 'true' }));
  assert.equal(saved.get('remoto-fixado').pinned, true);
  assert.equal(saved.get('remoto-antigo').pinned, false, 'aparelho com versão antiga não fixa nada');
  assert.equal(saved.get('remoto-invalido').pinned, false);

  // Painel: ordem, marca visível, ação no menu, edição preserva a marca. O Sync leva o objeto inteiro do grifo (payload = grifo).
  const panel = fs.readFileSync('src/presentation/components/StudyHighlightsPanel.tsx', 'utf8');
  assert.match(panel, /const visible = orderHighlights\(highlights\)\.filter/);
  assert.match(panel, /\{isPinned\(h\) \? "Fixado · " : ""\}/);
  assert.match(panel, /button\(isPinned\(h\) \? "Desafixar trecho" : "Fixar trecho"/);
  assert.match(panel, /createdAt: editing\?\.createdAt \?\? Date\.now\(\), pinned: editing\?\.pinned === true \}/);
  assert.match(fs.readFileSync('src/data/library/JournaledReadingData.ts', 'utf8'), /kind==='progress'\?progressSyncPayload\(args\[0\]\):args\[0\]/, 'grifo vai inteiro para o Sync');
  console.log('PASS pinned highlights: fixados primeiro, marca só com true, réplica recebe a marca e trata payload antigo como não fixado, painel com ação e edição preservando a marca. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
