// Actual app palette plus the five book themes (BUG 16). Does not prove physical displays.
const assert = require('node:assert/strict');
const { appThemeTokens, readerThemes, pdfReaderThemes } = require('./community-test-loader.cjs')()('src/theme/tokens.ts');
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};
for (const [mode, palette] of Object.entries(appThemeTokens)) {
  for (const surface of ['background', 'surface', 'surfaceSecondary', 'panel', 'input']) {
    for (const ink of ['text', 'secondaryText', 'accent']) {
      assert(contrast(palette[ink], palette[surface]) >= 4.5, `${mode}: ${ink}/${surface} must meet normal text contrast`);
    }
  }
  assert(contrast(palette.onAccent, palette.accent) >= 4.5, `${mode}: primary button text contrast`);
  for (const ink of ["text", "accent"]) assert(contrast(palette[ink], palette.accentSoft) >= 4.5, `${mode}: ${ink}/accentSoft (selected chip) contrast`);
  assert(contrast(palette.onDanger, palette.danger) >= 4.5, `${mode}: destructive button text contrast`);
  for (const surface of ["background", "surface", "panel"]) {
    assert(contrast(palette.danger, palette[surface]) >= 4.5, `${mode}: danger/${surface} text contrast`);
    assert(contrast(palette.success, palette[surface]) >= 4.5, `${mode}: success/${surface} text contrast`);
    assert(contrast(palette.focus, palette[surface]) >= 3, `${mode}: focus ring/${surface} non-text contrast`);
  }
}
// Book themes (Reader chrome/panels): text, secondary and accent ink on page and panel; text on a selected accent fill.
assert.deepEqual(Object.keys(readerThemes).sort(), ['black', 'dark', 'light', 'paper', 'sepia']);
for (const [name, theme] of Object.entries(readerThemes)) {
  for (const surface of ['background', 'panel']) for (const ink of ['text', 'secondaryText', 'accent']) {
    assert(contrast(theme[ink], theme[surface]) >= 4.5, `reader ${name}: ${ink}/${surface} must meet 4.5:1 (got ${contrast(theme[ink], theme[surface]).toFixed(2)})`);
  }
  assert(contrast(theme.onAccent, theme.accent) >= 4.5, `reader ${name}: onAccent/accent selected control text`);
  assert.deepEqual(pdfReaderThemes[name], theme, `reader ${name}: PDF themes stay equal to EPUB themes`);
}
console.log('PASS reader themes: 5 book themes meet 4.5:1 for text/secondary/accent on page and panel, and onAccent on accent.');
console.log('PASS actual light/dark app palette: body, secondary/link text and primary action ink, selected chip, danger/success >= 4.5:1; focus >= 3:1. Does not prove physical display or disabled controls.');
