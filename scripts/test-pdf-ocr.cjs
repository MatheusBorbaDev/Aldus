const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const loaded = new Map();
function load(file) {
  if (loaded.has(file)) return loaded.get(file);
  const exports = {};
  loaded.set(file, exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', source)(name => {
    const base = name.startsWith('@/') ? name.slice(2) : path.posix.join(path.posix.dirname(file), name);
    const target = ['.ts', '.tsx', ''].map(extension => base + extension).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    return target ? load(target) : require(name);
  }, exports);
  return exports;
}

const builder = load('src/data/local/PdfReflowDocumentBuilder.ts');
const policy = load('src/data/local/pdfOcrPolicy.ts');
const quality = load('src/data/local/pdfReflowQuality.ts');
const types = load('src/domain/types/pdfReader.ts');

const item = (text, y = 650) => ({ text, direction: 'ltr', x: 30, y, width: 430, height: 14, fontName: 'Fixture', hasEOL: true });
const readable = 'Ação, coração, informação, português: á é í ó ú â ê ô ã õ ç. '.repeat(18);
const cleanPage = number => ({ pageNumber: number, pageWidth: 500, pageHeight: 700, textItems: [item(readable)], images: [] });
const scanPage = number => ({ pageNumber: number, pageWidth: 500, pageHeight: 700, textItems: [], images: [{ src: 'data:image/jpeg;base64,fixture', x: 0, y: 0, width: 500, height: 700 }] });
const ocrItems = [item('Ação e coração em português, com pontuação correta. '.repeat(7), 650), item('A literatura preserva acentos e ordem das linhas. '.repeat(7), 620)];

// A: healthy text never enters OCR.
assert.deepEqual(policy.createPdfOcrPlan([cleanPage(1)]).pageNumbers, []);

// B: scanned page enters OCR, validated output reaches Reflow.
const scanPlan = policy.createPdfOcrPlan([scanPage(1)]);
assert.deepEqual(scanPlan.pageNumbers, [1]);
const ocrDocument = builder.buildPdfReflowDocument(
  [policy.replacePageWithOcr(scanPage(1), ocrItems)],
  1,
  policy.createReflowDerivation(1, [1])
);
assert.equal(quality.isValidatedReflowDocument(ocrDocument), true);
assert.notEqual(ocrDocument.classification, 'image-based');

// C: corrupt extracted text is rejected and routed to OCR.
const corrupt = { ...cleanPage(1), textItems: [item('\u0001\u0002'.repeat(180) + 'A')] };
assert.deepEqual(policy.createPdfOcrPlan([corrupt]).pageNumbers, [1]);

// D: mixed PDF replaces only the scanned page and avoids the full-page duplicate.
const mixed = [cleanPage(1), scanPage(2), cleanPage(3)];
assert.deepEqual(policy.createPdfOcrPlan(mixed).pageNumbers, [2]);
const mixedPages = mixed.map(page => page.pageNumber === 2 ? policy.replacePageWithOcr(page, ocrItems) : page);
assert.equal(mixedPages[1].images.length, 0);
const mixedDocument = builder.buildPdfReflowDocument(mixedPages, 3, policy.createReflowDerivation(3, [2]));
assert.equal(quality.isValidatedReflowDocument(mixedDocument), true);
assert.equal(mixedDocument.derivation.source, 'hybrid');

// E: a truly empty page inside an otherwise healthy document does not force OCR.
const blank = { ...scanPage(2), images: [] };
assert.deepEqual(policy.createPdfOcrPlan([cleanPage(1), blank]).pageNumbers, []);

// F: small document and Portuguese normalization/order/hyphen reconstruction.
const hyphenated = { ...cleanPage(1), textItems: [item('A litera-', 650), item('tura brasileira tem ação e coração.', 630), ...ocrItems] };
const small = builder.buildPdfReflowDocument([hyphenated], 1);
const smallText = small.chapters.flatMap(chapter => chapter.blocks).map(block => block.text || '').join(' ');
assert.match(smallText, /literatura/);
assert.match(smallText.normalize('NFC'), /ação e coração/);

// G: hundreds of healthy text pages still select zero OCR pages.
const largePages = Array.from({ length: 300 }, (_, index) => cleanPage(index + 1));
assert.deepEqual(policy.createPdfOcrPlan(largePages).pageNumbers, []);
assert.match(fs.readFileSync('src/data/local/pdfOcr.native.ts', 'utf8'), /1800/);
assert.match(fs.readFileSync('modules/aldus-pdf-ocr/android/src/main/java/expo/modules/alduspdfocr/AldusPdfOcrModule.kt', 'utf8'), /bitmap\?\.recycle\(\)/);

// H: cancellation is terminal, stops new work and marks the native operation.
const { createReflowOperation } = load('src/presentation/components/reflowOperation.ts');
const operation = createReflowOperation();
assert.equal(operation.finish(), true);
assert.equal(operation.signal.aborted, true);
assert.equal(operation.finish(), false);
assert.match(fs.readFileSync('src/presentation/components/PdfReflowProcessor.native.tsx', 'utf8'), /cancelPdfOcr/);

// I: insufficient/noisy OCR cannot become a validated Reflow document.
assert.equal(policy.isSufficientOcrText([item('??')]), false);
assert.equal(policy.isSufficientOcrText([item('texto\uFFFD\uFFFD\uFFFD ruim')]), false);

// J: only a validated terminal OCR result satisfies the versioned cache contract.
const cacheRecord = { id: 'fixture', sourceSignature: 'hash', processorVersion: types.PDF_REFLOW_PROCESSOR_VERSION, document: ocrDocument, updatedAt: 1 };
assert.equal(cacheRecord.processorVersion, 12);
assert.equal(quality.isValidatedReflowDocument(cacheRecord.document), true);
assert.equal(quality.isValidatedReflowDocument({ ...ocrDocument, derivation: { ...ocrDocument.derivation, ocrEngineVersion: undefined } }), false);

// Painel do OCR: cores do tema escuro do app (antes terracota fixa #B65F42 + branco, 4,46:1, abaixo de AA) e alvo de 44 px.
{
  const fs = require('node:fs');
  const native = fs.readFileSync('src/presentation/components/PdfReflowProcessor.native.tsx', 'utf8');
  const web = fs.readFileSync('src/presentation/components/PdfReflowProcessor.web.tsx', 'utf8');
  for (const source of [native, web]) assert.ok(!/color[=:]\s*\{?\s*["']#B65F42["']|backgroundColor:\s*"#B65F42"/.test(source), 'sem terracota fixa');
  assert.match(native, /backgroundColor: OCR_ACCENT[^}]*minHeight: 44/);
  assert.match(native, /primaryActionText: \{ color: OCR_ON_ACCENT/);
  const tokens = fs.readFileSync('src/theme/tokens.ts', 'utf8');
  const dark = tokens.slice(tokens.indexOf('  dark: {'));
  const hex = key => dark.match(new RegExp(`\\b${key}: "(#[0-9A-Fa-f]{6})"`))[1];
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const [a, b] = [lum(hex('accent')), lum(hex('onAccent'))].sort((x, y) => y - x);
  assert.ok((a + 0.05) / (b + 0.05) >= 4.5, 'texto do botão do OCR com contraste AA');
}

console.log('OCR A-J PASS: text, scan, corrupt, mixed, blank, small, large, cancel, insufficient and versioned cache; Portuguese accents/order/hyphenation PASS; OCR panel uses dark app tokens (AA)');
