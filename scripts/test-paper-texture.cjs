// Paper texture on the book page (owner's request, 16/11/2026): pure rules. Contrast of the book text against the
// worst pixel (every layer at its maximum) for all five book themes and both textures; CSS stays data:-only (document CSP).
const assert = require('node:assert/strict');
const load = require('./community-test-loader.cjs')();
const { PAPER_TEXTURES, isPaperTexture, paperTextureCss, paperTextureLayers, paperTextureWorstBackground } = load('src/domain/reader/paperTexture.ts');
const { readerThemes } = load('src/theme/tokens.ts');
const lum = hex => { const c = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const v = [lum(a), lum(b)].sort((x, y) => y - x); return (v[0] + .05) / (v[1] + .05); };

assert.deepEqual(PAPER_TEXTURES.map(t => t.value), ['none', 'paper', 'aged']);
assert.deepEqual(PAPER_TEXTURES.map(t => t.label), ['Sem textura', 'Papel', 'Papel envelhecido']);
assert.ok(isPaperTexture('aged') && !isPaperTexture('linen') && !isPaperTexture(undefined));

for (const [name, theme] of Object.entries(readerThemes)) {
  assert.equal(paperTextureCss('none', theme.background), 'none', `${name}: none turns the texture off`);
  assert.equal(paperTextureWorstBackground('none', theme.background).toLowerCase(), theme.background.toLowerCase());
  for (const texture of ['paper', 'aged']) {
    const worst = paperTextureWorstBackground(texture, theme.background, theme.text);
    // Only the book text sits on the texture: the document forces `color: inherit` on every element, the footer has its own
    // opaque background and the loading screen is outside the document, so secondaryText never lands on the grain.
    const ratio = contrast(theme.text, worst);
    assert.ok(ratio >= 4.5, `${name}/${texture}: book text on the most marked pixel ${ratio.toFixed(2)} >= 4.5`);
    const css = paperTextureCss(texture, theme.background, theme.text);
    assert.match(css, /^url\("data:image\/svg\+xml,/, `${name}/${texture}: data: SVG tile`);
    const end = css.indexOf('")'), svg = decodeURIComponent(css.slice(css.indexOf('svg+xml,') + 8, end));
    assert.ok(!/https?:|javascript:|[{};]/.test(svg.replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/, '')), `${name}/${texture}: no external URL or extra CSS in the tile`);
    assert.ok(!/[{};]|url\(/.test(css.slice(end + 2)), `${name}/${texture}: after the tile only a gradient`);
    const dark = ['dark', 'black'].includes(name);
    const layers = paperTextureLayers(texture, theme.background, theme.text);
    assert.equal(layers.grain.color, dark ? '#FFFFFF' : '#4A3B2C', `${name}/${texture}: grain follows the page tone`);
    // Visible on a phone (owner's APK test, 16/11): far stronger than the old 8% grain, still bounded by the text contrast.
    assert.ok(layers.grain.maxAlpha + layers.mottle.maxAlpha >= (dark ? 0.1 : 0.15), `${name}/${texture}: visible paper ${JSON.stringify(layers)}`);
    assert.match(svg, /feFuncA type='table'/, `${name}/${texture}: noise spread into real grain`);
    assert.equal(/radial-gradient/.test(css), texture === 'aged', `${name}/${texture}: only the aged paper darkens the edges`);
  }
  assert.notEqual(paperTextureCss('paper', theme.background), paperTextureCss('aged', theme.background));
}
console.log('PASS paper texture: 3 options; data:-only SVG grain (light grain on dark pages, dark grain on light pages); book text >= 4.5:1 on the most marked pixel for 5 book themes x 2 textures. Does not prove the rendered look on a device.');
