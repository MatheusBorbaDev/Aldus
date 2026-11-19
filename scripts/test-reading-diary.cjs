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
// Calendário (19/11): semanas de domingo a sábado, livros do dia na ordem do diário, dias vazios e bordas do mês.
const nov = diary.calendarMonth(2026, 10, days);
assert.equal(nov.length, 5, 'novembro de 2026 começa num domingo: 5 semanas'); assert.ok(nov.every(week => week.length === 7));
assert.equal(nov[0][0].day, '2026-11-01'); assert.equal(nov[1][2].day, '2026-11-10');
assert.deepEqual(nov[1][2].bookIds, ['b1', 'b2'], 'livros do dia 10 na ordem do diário');
assert.deepEqual(nov[1][4].bookIds, ['b2', 'removido']); assert.deepEqual(nov[1][3].bookIds, [], 'dia sem tempo ativo fica vazio');
assert.equal(nov[4][1].day, '2026-11-30'); assert.equal(nov[4][2].day, null, 'fim da grade preenchido com vazios');
const feb = diary.calendarMonth(2028, 1, []); assert.equal(feb[0].filter(cell => cell.day).length, 5, 'fevereiro de 2028 começa na terça'); assert.equal(feb.flat().filter(cell => cell.day).length, 29, 'ano bissexto');
assert.equal(diary.calendarMonthLabel(2026, 10), 'Novembro de 2026'); assert.equal(diary.diaryFullDayLabel('2026-11-10'), '10 de novembro de 2026');
// Textos e código (sem comentários, que explicam justamente o que NÃO existe) não falam em sequência, ranking ou meta diária.
const source = (fs.readFileSync('src/domain/reader/readingDiary.ts', 'utf8') + fs.readFileSync('src/presentation/screens/ReadingDiaryScreen.tsx', 'utf8') + fs.readFileSync('src/presentation/components/ReadingCalendar.tsx', 'utf8'))
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
// Personal rating and review (18/11/2026): exported only when the person wrote them; a rating out of 1–5 is never written.
const rated = csv.goodreadsCsv([{ title: 'T', author: 'A', addedDate: null, status: 'completed', collections: [], rating: 4, review: 'Bom, "muito".' },
  { title: 'U', author: 'B', addedDate: null, status: 'completed', collections: [], rating: 9, review: '=1+1' }]).trimEnd().split('\r\n');
assert.equal(rated[1], 'T,A,,,4,,,,,read,"Bom, ""muito"".",');
assert.equal(rated[2], `U,B,,,,,,,,read,'=1+1,`, 'invalid rating left empty; formula neutralized in the review');

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
    '@/src/presentation/components/ReadingCalendar': { ReadingCalendar: props => React.createElement('Calendar', props) },
  });
  const { ReadingDiaryScreen } = load('src/presentation/screens/ReadingDiaryScreen.tsx');
  let tree; const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const render = async () => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(ReadingDiaryScreen)); }); await flush(); };
  const text = () => tree.root.findAllByType('Text').map(n => [n.props.children].flat().join('')).join('\n');
  await render();
  assert.match(text(), /Hoje · 15 min/); assert.match(text(), /Dom Casmurro · 15 min/);
  const calendar = tree.root.findByType('Calendar'); assert.equal(calendar.props.days.length, 1); assert.equal(calendar.props.books.get('b1').title, 'Dom Casmurro');
  await act(async () => calendar.props.onSelect('2000-01-01')); assert.ok(!/Dom Casmurro · 15 min/.test(text()), 'a selected day shows only its sessions');
  await act(async () => tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === 'Mostrar todos os dias').props.onPress()); assert.match(text(), /Dom Casmurro · 15 min/);
  const toggle = tree.root.findByType('Switch'); assert.equal(toggle.props.value, true);
  await act(async () => toggle.props.onValueChange(false)); assert.equal(hide, true, 'interruptor usa a mesma preferência do leitor');
  await render(); assert.ok(!/\d+ min/.test(text()), 'minutos ocultos'); assert.match(text(), /Hoje/); assert.match(text(), /Dom Casmurro/);
  await act(async () => tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === 'Exportar CSV (Goodreads)').props.onPress()); await flush();
  assert.equal(shared.length, 1); assert.match(shared[0].message, /^Title,Author,ISBN/); assert.match(shared[0].message, /Dom Casmurro,Machado de Assis,,,,,,2026\/11\/03,Clássicos,read,,/);
  assert.match(text(), /nenhum arquivo de livro/);
  await act(async () => tree.unmount());
  assert.match(fs.readFileSync('app/(tabs)/library.tsx', 'utf8'), /label: "Diário de leitura"[^\n]*router\.push\("\/diary"/);
  // O calendário desenhado: capa no dia lido, rótulo acessível com o livro, dia sem leitura desativado, navegação de mês.
  {
    const ui2 = { AppText: ({ children }) => React.createElement('Text', null, children), IconButton: props => React.createElement('Pressable', { accessibilityLabel: props.label, onPress: props.onPress }) };
    const loadCal = require('./community-test-loader.cjs')({
      react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
      'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x, absoluteFill: {}, hairlineWidth: 1 } }, '@/src/ui': ui2,
      '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette: { border: '#ddd', surface: '#fff', accent: '#a00', accentSoft: '#fee' } }) },
      '@/src/presentation/components/BookCover': { BookCover: props => React.createElement('Cover', props) }, '@/src/utils/coverHelper': { getBookCover: () => null },
      '@/src/presentation/services/bookDisplay': { readableBookTitle: book => book.title },
    });
    const { ReadingCalendar } = loadCal('src/presentation/components/ReadingCalendar.tsx');
    let picked = null, cal;
    const calBooks = new Map([['b1', { id: 'b1', title: 'Dom Casmurro', author: 'Machado', mimeType: 'application/epub+zip', filePath: 'f', progress: 0 }], ['b2', { id: 'b2', title: 'Quincas Borba', author: 'Machado', mimeType: 'application/pdf', filePath: 'g', progress: 0 }]]);
    await act(async () => { cal = create(React.createElement(ReadingCalendar, { days, books: calBooks, selected: null, onSelect: day => { picked = day; }, now: at(2026, 11, 19) })); });
    const label = text => cal.root.findAll(n => n.type === 'Pressable' && String(n.props.accessibilityLabel ?? '').includes(text))[0];
    assert.equal(cal.root.findAll(n => n.type === 'Text' && [n.props.children].flat().join('') === 'Novembro de 2026').length, 1);
    const tenth = label('10 de novembro de 2026'); assert.match(tenth.props.accessibilityLabel, /leu Dom Casmurro, Livro removido da biblioteca|leu Dom Casmurro/);
    assert.equal(cal.root.findAll(n => n.type === 'Cover').length, 2, 'one cover per day read (10 and 12)');
    assert.equal(label('11 de novembro de 2026').props.disabled, true, 'a day without reading cannot be selected');
    await act(async () => tenth.props.onPress()); assert.equal(picked, '2026-11-10');
    await act(async () => label('Mês anterior').props.onPress());
    assert.equal(cal.root.findAll(n => n.type === 'Text' && [n.props.children].flat().join('') === 'Outubro de 2026').length, 1); assert.equal(cal.root.findAll(n => n.type === 'Cover').length, 0);
    await act(async () => cal.unmount());
  }
  console.log('PASS reading diary: calendário com capas (mês, dias lidos, seleção, navegação); só sessões medidas por dia e livro, rótulos de dia sem Intl, minutos ocultáveis pela preferência do leitor; CSV Goodreads com colunas oficiais, vazios onde não há dado, escape e proteção contra fórmula. Sem aparelho.');
})().catch(error => { console.error(error); process.exit(1); });
