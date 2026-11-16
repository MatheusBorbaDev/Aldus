// FASE 3, B1 e B2: diário de leitura (só sessões medidas, agrupadas por dia, minutos ocultáveis) e CSV no padrão Goodreads
// (só dados reais; colunas desconhecidas vazias; escape RFC 4180 e proteção contra fórmula). Tela real com dependências simuladas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const domainLoad = require('./community-test-loader.cjs')({ 'react-native': { Platform: { OS: 'android' } } });
const diary = domainLoad('src/domain/reader/readingDiary.ts');
const csv = domainLoad('src/domain/library/goodreadsCsv.ts');

// Diário.
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
const session = (id, bookId, start, seconds) => ({ id, bookId, format: 'epub', startedAt: start, endedAt: start + seconds * 1000 + 1000, activeSeconds: seconds, focusGoalMinutes: null, focusGoalReached: null });
const days = diary.buildDiary([
  session('s1', 'b1', at(2026, 11, 10, 9), 600), session('s2', 'b1', at(2026, 11, 10, 21), 300), session('s3', 'b2', at(2026, 11, 10, 15), 120),
  session('s4', 'b2', at(2026, 11, 12, 8), 4000), session('s5', 'removido', at(2026, 11, 12, 7), 60), session('zero', 'b1', at(2026, 11, 11), 0),
], new Map([['b1', 'Dom Casmurro'], ['b2', 'Quincas Borba']]));
assert.deepEqual(days.map(d => d.day), ['2026-11-12', '2026-11-10'], 'dias do mais recente; dia sem tempo ativo não aparece');
assert.equal(days[1].seconds, 1020);
assert.deepEqual(days[1].books.map(b => [b.title, b.seconds, b.sessions]), [['Dom Casmurro', 900, 2], ['Quincas Borba', 120, 1]]);
assert.equal(days[0].books.find(b => b.bookId === 'removido').title, 'Livro removido da biblioteca');
assert.equal(diary.formatActiveTime(30), 'menos de 1 min'); assert.equal(diary.formatActiveTime(900), '15 min'); assert.equal(diary.formatActiveTime(4000), '1 h 06 min'); assert.equal(diary.formatActiveTime(7200), '2 h');
assert.equal(diary.diaryDayLabel('2026-11-16', '2026-11-16', '2026-11-15'), 'Hoje');
assert.equal(diary.diaryDayLabel('2026-11-15', '2026-11-16', '2026-11-15'), 'Ontem');
assert.equal(diary.diaryDayLabel('2026-11-10', '2026-11-16', '2026-11-15'), 'Terça-feira, 10 de novembro');
assert.equal(diary.diaryDayLabel('2025-12-31', '2026-11-16', '2026-11-15'), 'Quarta-feira, 31 de dezembro de 2025');
// Textos e código (sem comentários, que explicam justamente o que NÃO existe) não falam em sequência, ranking ou meta diária.
const source = (fs.readFileSync('src/domain/reader/readingDiary.ts', 'utf8') + fs.readFileSync('src/presentation/screens/ReadingDiaryScreen.tsx', 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(source, /streak|sequência de dias|dias seguidos|ranking|meta diária/i);

// CSV Goodreads.
const output = csv.goodreadsCsv([
  { title: 'Dom Casmurro', author: 'Machado de Assis', addedDate: at(2026, 11, 3), status: 'completed', collections: ['Clássicos', 'Realismo'] },
  { title: 'Livro, "com" vírgula', author: null, addedDate: null, status: 'interrupted', collections: [] },
  { title: '=HYPERLINK("x")', author: '+cmd', addedDate: at(2026, 1, 9), status: 'unread', collections: ['  '] },
  { title: 'Em leitura', author: 'A', addedDate: at(2026, 2, 1), status: 'reading', collections: [] },
]);
const lines = output.trimEnd().split('\r\n');
assert.equal(lines[0], 'Title,Author,ISBN,ISBN13,My Rating,Number of Pages,Date Read,Date Added,Bookshelves,Exclusive Shelf,My Review,Private Notes');
assert.equal(lines[1], 'Dom Casmurro,Machado de Assis,,,,,,2026/11/03,"Clássicos, Realismo",read,,');
assert.equal(lines[2], '"Livro, ""com"" vírgula",,,,,,,,interrompido,currently-reading,,');
assert.equal(lines[3], `"'=HYPERLINK(""x"")",'+cmd,,,,,,2026/01/09,,to-read,,`, 'fórmula neutralizada');
assert.equal(lines[4], 'Em leitura,A,,,,,,2026/02/01,,currently-reading,,');
assert.ok(output.endsWith('\r\n'));
for (const line of lines.slice(1)) assert.equal(line.split(',').length >= 12, true);
assert.equal(csv.exclusiveShelf('unread'), 'to-read');

(async () => {
  // Tela: minutos seguem "Ocultar porcentagem e páginas"; exportação só com dados da conta.
  let hide = false; const shared = [];
  const deps = { libraryOrganization: { list: async () => ({ b1: { collections: ['Clássicos'], readingStatus: 'completed' } }) }, appDependencies: {
    readingSessions: { list: async () => [session('s1', 'b1', Date.now() - 1000 * 60 * 30, 900)] },
    bookRepository: { listActive: async () => [{ id: 'b1', title: 'Dom Casmurro', author: 'Machado de Assis', addedDate: at(2026, 11, 3), isDeleted: false, progress: 1 }] },
  } };
  const ui = {
    AppText: ({ children }) => React.createElement('Text', null, children), Screen: ({ header, children }) => React.createElement('View', null, header, children),
    ScreenHeader: ({ title }) => React.createElement('Text', null, title), EmptyState: ({ title }) => React.createElement('Text', null, title),
    Button: props => React.createElement('Pressable', { accessibilityLabel: props.label, onPress: props.onPress, disabled: props.disabled }),
  };
  const load = require('./community-test-loader.cjs')({
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { View: 'View', Switch: 'Switch', Platform: { OS: 'android' }, Share: { share: async value => { shared.push(value); } }, StyleSheet: { create: x => x, hairlineWidth: 1 } },
    '@/src/ui': ui,
    '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { border: '#ddd', surface: '#fff', accent: '#a00' } }) },
    '@/src/presentation/contexts/ReaderSettingsContext': { useReaderSettings: () => ({ hideReadingCounts: hide, setHideReadingCounts: value => { hide = value; } }) },
    '@/src/presentation/services/dependencies': deps,
    '@/src/presentation/services/bookDisplay': { readableBookTitle: book => book.title },
    '@/src/data/library/LibraryAccountScope': { libraryAccountScope: { capture: () => ({ userId: 'A', check: () => undefined }) } },
  });
  const { ReadingDiaryScreen } = load('src/presentation/screens/ReadingDiaryScreen.tsx');
  let tree; const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const render = async () => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(ReadingDiaryScreen)); }); await flush(); };
  const text = () => tree.root.findAllByType('Text').map(n => [n.props.children].flat().join('')).join('\n');
  await render();
  assert.match(text(), /Hoje · 15 min/); assert.match(text(), /Dom Casmurro · 15 min/);
  const toggle = tree.root.findByType('Switch'); assert.equal(toggle.props.value, true);
  await act(async () => toggle.props.onValueChange(false)); assert.equal(hide, true, 'interruptor usa a mesma preferência do leitor');
  await render(); assert.ok(!/\d+ min/.test(text()), 'minutos ocultos'); assert.match(text(), /Hoje/); assert.match(text(), /Dom Casmurro/);
  await act(async () => tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === 'Exportar CSV (Goodreads)').props.onPress()); await flush();
  assert.equal(shared.length, 1); assert.match(shared[0].message, /^Title,Author,ISBN/); assert.match(shared[0].message, /Dom Casmurro,Machado de Assis,,,,,,2026\/11\/03,Clássicos,read,,/);
  assert.match(text(), /nenhum arquivo de livro/);
  await act(async () => tree.unmount());
  assert.match(fs.readFileSync('app/(tabs)/library.tsx', 'utf8'), /label: "Diário de leitura"[^\n]*router\.push\("\/diary"/);
  console.log('PASS reading diary: só sessões medidas por dia e livro, rótulos de dia sem Intl, minutos ocultáveis pela preferência do leitor; CSV Goodreads com colunas oficiais, vazios onde não há dado, escape e proteção contra fórmula. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
