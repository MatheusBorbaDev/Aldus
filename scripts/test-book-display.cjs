// Redesign step 2: one display-title rule for Library and Reader, and the transient Reader notice.
const assert = require('node:assert/strict'), fs = require('node:fs');
const load = require('./community-test-loader.cjs')({});
const { readableBookTitle, catalogBookFor, normalizeBookTitle } = load('src/presentation/services/bookDisplay.ts');
const { MOCK_BOOKS } = load('src/constants/mockBooks.ts');
// Bundled books are stored with the file name as title: both screens show the catalog title.
const seneca = MOCK_BOOKS.find(book => /vida feliz/i.test(book.title)); assert.ok(seneca, 'catalog fixture');
const fileName = seneca.fileUri.split(/[\\/]/).pop();
assert.equal(readableBookTitle({ title: 'sobre-a-vida-feliz', fileName }), seneca.title);
assert.equal(catalogBookFor({ title: 'qualquer', fileName }), seneca);
// Unknown books: never invented, only separators become spaces when the title is clearly a file name.
assert.equal(readableBookTitle({ title: 'meu_livro-novo.epub', fileName: 'meu_livro-novo.epub' }), 'Meu livro novo');
assert.equal(readableBookTitle({ title: 'Guerra e Paz - Volume 1' }), 'Guerra e Paz - Volume 1', 'a real title with spaces is kept as saved');
assert.equal(readableBookTitle({ title: 'Ulisses' }), 'Ulisses'); assert.equal(readableBookTitle({ title: '' }), '');
assert.equal(normalizeBookTitle('Memórias Póstumas!'), 'memorias postumas');
const reader = fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8'), library = fs.readFileSync('app/(tabs)/library.tsx', 'utf8');
assert.match(reader, /setBookTitle\(readableBookTitle\(result\.book\)\)/); assert.match(library, /catalogBookFor\(book\)/);
// Only the success confirmation is transient; failure/anchor warnings keep their close button and alert role.
assert.match(reader, /const transientFeedback = reflowFeedback === REFLOW_READY_MESSAGE;/);
assert.match(reader, /accessibilityRole=\{transientFeedback \? undefined : "alert"\}/);
assert.match(reader, /current === REFLOW_READY_MESSAGE \? null : current/, 'the timer never clears a newer warning');
console.log('PASS book display: catalog title for bundled files in Library and Reader, readable file-name titles, saved titles untouched; only the success notice is transient.');
// The accent-stripping range must stay escaped: literal combining marks break bundles served without a charset.
assert.ok(fs.readFileSync('src/presentation/services/bookDisplay.ts', 'utf8').includes(String.fromCharCode(92) + 'u0300-' + String.fromCharCode(92) + 'u036f'), 'escaped combining-mark range');
