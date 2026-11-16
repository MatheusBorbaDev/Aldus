// Actual app palette plus the five book themes (BUG 16). Does not prove physical displays.
const assert = require('node:assert/strict');
const { appThemeTokens, appPalettes, appPaletteOptions, isAppPaletteName, readerChromePalette, readerThemes, pdfReaderThemes } = require('./community-test-loader.cjs')()('src/theme/tokens.ts');
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};
// Clássico + Moderno (Petróleo, Azul-tinta), pedido de 16/11/2026: every palette, light and dark, meets the same contract.
assert.deepEqual(Object.keys(appPalettes).sort(), ['classic', 'ink', 'petroleum']);
assert.equal(appPalettes.classic, appThemeTokens, 'Clássico is the original palette, unchanged');
assert.deepEqual(appPaletteOptions.map(o => o.value), ['classic', 'petroleum', 'ink']);
assert.ok(isAppPaletteName('ink') && !isAppPaletteName('dark') && !isAppPaletteName(null));
for (const [name, variants] of Object.entries(appPalettes)) for (const [variant, palette] of Object.entries(variants)) {
  const mode = `${name}/${variant}`;
  assert.deepEqual(Object.keys(palette).sort(), Object.keys(appThemeTokens.light).sort(), `${mode}: same token set as the original`);
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
// Reader controls follow the app palette accent only when it keeps 4.5:1 on the book page and panel; book text/background never change.
for (const name of Object.keys(appPalettes)) for (const [theme, palette] of Object.entries(readerThemes)) {
  const chrome = readerChromePalette(palette, name);
  for (const key of ['background', 'text', 'secondaryText', 'separator', 'panel']) assert.equal(chrome[key], palette[key], `${name}/${theme}: ${key} is the book's own`);
  for (const surface of ['background', 'panel']) assert(contrast(chrome.accent, chrome[surface]) >= 4.5, `${name}/${theme}: accent/${surface}`);
  assert(contrast(chrome.onAccent, chrome.accent) >= 4.5, `${name}/${theme}: onAccent/accent`);
  if (name === 'classic') assert.equal(chrome, palette, 'Clássico keeps the book theme as is');
  else assert.equal(chrome.accent, appPalettes[name][['dark', 'black'].includes(theme) ? 'dark' : 'light'].accent, `${name}/${theme}: uses the palette accent`);
}
assert.equal(readerChromePalette(readerThemes.light, null), readerThemes.light, 'outside the app theme provider the book theme is unchanged');
console.log('PASS reader themes: 5 book themes meet 4.5:1 for text/secondary/accent on page and panel, and onAccent on accent.');
console.log('PASS 3 app palettes (Clássico, Moderno Petróleo, Moderno Azul-tinta) x light/dark and Reader controls per palette: body, secondary/link text and primary action ink, selected chip, danger/success >= 4.5:1; focus >= 3:1. Does not prove physical display or disabled controls.');
