// BUG 17 (onda B3): hifenização do EPUB precisa de idioma declarado; justificar passa a valer também no EPUB.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const out = ts.transpileModule(fs.readFileSync('src/presentation/components/EpubReaderDocument.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = {}; new Function('require', 'exports', out)(() => new Proxy({}, { get: (_t, k) => k === '__esModule' ? false : () => '' }), m);
const { chapterLanguage, createEpubReaderDocument } = m;
assert.equal(chapterLanguage('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR" lang="pt-BR"><body><p>a</p></body></html>'), 'pt-BR');
assert.equal(chapterLanguage('<html><body lang="en"><p>a</p></body></html>'), 'en', 'body lang also counts');
assert.equal(chapterLanguage('<html><body><p lang="fr">a</p></body></html>'), null, 'inner elements are not the chapter language');
assert.equal(chapterLanguage('<html lang="x"><body></body></html>'), null, 'invalid tag ignored');
assert.equal(chapterLanguage('<html lang="pt-BR&quot;><script>"><body></body></html>'), null, 'nothing unsafe passes');
assert.equal(chapterLanguage('<p>sem html</p>'), null, 'no declaration → no language (never presumed)');
const palette = { background: '#fff', text: '#000' };
const opts = { textColor: '#000', backgroundColor: '#fff', fontSize: 16, fontFamily: 'Georgia', marginSize: 20 };
const doc = createEpubReaderDocument([
  { id: 'c1', title: 'Um', html: '<html lang="pt-BR"><body><p>um</p></body></html>' },
  { id: 'c2', title: 'Two', html: '<html xml:lang="en-US"><body><p>two</p></body></html>' },
  { id: 'c3', title: 'Três', html: '<p>três</p>' },
], { ...opts, alignment: 'justify' });
assert.match(doc, /^<!doctype html>\s*<html lang="pt-BR">/, 'document language = first declared chapter');
assert.match(doc, /<section id="epub-chapter-0" class="epub-chapter" lang="pt-BR"/); assert.match(doc, /<section id="epub-chapter-1" class="epub-chapter" lang="en-US"/, 'per-chapter language');
assert.match(doc, /<section id="epub-chapter-2" class="epub-chapter" data-chapter-id/, 'chapter without declaration has no lang');
assert.match(doc, /text-align: justify !important;/); assert.match(doc, /hyphens: auto;/);
assert.match(createEpubReaderDocument([{ id: 'c', title: 't', html: '<p>x</p>' }], opts), /^<!doctype html>\s*<html>/, 'no declared language → plain <html>');
// EPUB alignment wiring: setting in the context, passed by ReaderScreen, offered by the panel for EPUB too.
const context = fs.readFileSync('src/presentation/contexts/ReaderSettingsContext.tsx', 'utf8'), screen = fs.readFileSync('src/presentation/screens/ReaderScreen.tsx', 'utf8'), panel = fs.readFileSync('src/presentation/components/ReaderSettingsPanel.tsx', 'utf8');
assert.match(context, /parsed\.alignment === "left" \|\| parsed\.alignment === "justify"/, 'only valid saved values are restored');
assert.match(screen, /alignment: settings\.alignment \?\? "left",/); assert.doesNotMatch(screen, /alignment: "left" as const/);
assert.match(panel, /settings\.setAlignment\?\.\("justify"\)/);
console.log('PASS EPUB language/alignment (BUG 17): chapter language from <html>/<body> only, validated, never presumed; document and section lang; justify setting for EPUB wired and persisted.');
