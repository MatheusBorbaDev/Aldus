// Page turn (phase D, 16/11/2026): rule for the effective mode. The document behaviour is covered by test:reader:browser.
const assert = require('node:assert/strict');
const { PAGE_TURNS, effectivePageTurn, isPageTurn } = require('./community-test-loader.cjs')()('src/domain/reader/pageTurn.ts');
assert.deepEqual(PAGE_TURNS.map(t => [t.value, t.label]), [['none', 'Sem animação'], ['slide', 'Deslizar'], ['flip', 'Folhear']]);
assert.ok(isPageTurn('flip') && !isPageTurn('curl') && !isPageTurn(undefined));
for (const choice of ['none', 'slide', 'flip']) {
  assert.equal(effectivePageTurn(choice, false), choice, `${choice} kept without reduce motion`);
  assert.equal(effectivePageTurn(choice, true), 'none', `${choice} becomes none with reduce motion`);
}
console.log('PASS page turn rule: three options, reduce motion forces "Sem animação" without changing the saved choice.');
