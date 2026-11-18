// Deterministic suites only. Browser/physical/remote QA are separate, never silently claimed.
const { spawnSync } = require('node:child_process');
const tests = [
  'bundled-catalog', 'legacy-reattach',
  'app-design', 'ui-primitives', 'discover-ui', 'error-boundary', 'source-presentation', 'preference-persistence', 'book-display', 'study-review', 'highlight-flashcard', 'reading-shelves', 'reader-theme-auto', 'review-history', 'first-steps', 'release-notes', 'native-brightness', 'reader-last-page', 'epub-language', 'reading-pace', 'read-aloud', 'review-reminder', 'open-with', 'pdfjs-lazy',
  'library-bulk',
  'beta-preparation', 'metro-test-isolation', 'pt-br', 'marketing', 'cinematic-book', 'book-scroll-controller', 'admin-security', 'admin-client', 'admin-presentation', 'admin-layout',
  'saas-quotas', 'saas-quota-client', 'saas-quota-driver',
  'saas-schema', 'saas-client', 'saas-compatibility', 'saas-experience', 'saas-ui',
  'auth', 'auth-flows', 'auth-callback', 'auth-native-callback', 'username-login', 'account-delete', 'account-delete-ui', 'integrated-security', 'battle-account',
  'flashcards', 'flashcard-scoring', 'flashcard-storage', 'flashcard-sessions', 'flashcard-ui', 'flashcard-battles',
  'library-account', 'library-sync', 'library-remote', 'library-cancellation', 'library-files', 'library-reading-sync', 'library-coordinator', 'library-restart', 'library-rls', 'library-ui', 'library-organization', 'library-last-read',
  'google-drive', 'drive-renewal', 'drive-folder-picker', 'drive-tree', 'drive-download', 'source-catalog', 'source-library-actions', 'source-indexing', 'source-ownership', 'source-preparation', 'source-performance', 'source-ui', 'auth-native-pkce',
  'book-covers', 'catalog', 'catalog-records', 'file-hash', 'book-organization-modal', 'cover-thumbnails', 'epub-resources', 'epub-native-read', 'epub-image-readiness', 'book-import', 'import-duplicates', 'download-import', 'catalogs', 'reading-anchors', 'study-storage',
  'settings-navigation', 'reader-navigation', 'reader-native', 'reader-bytecode', 'book-html-security', 'platform-security', 'release-features', 'pinned-highlights', 'all-annotations', 'reading-diary', 'focus-card', 'paper-texture', 'highlight-popup', 'quote-card', 'quote-card-modal', 'page-turn', 'pdf-scroll', 'reader-location', 'reader-screen', 'reader-settings', 'reader-settings-categories', 'reading-session', 'reading-milestones', 'reader-concentration', 'reader-preferences-layout', 'reflow-native-scheduling', 'reflow-finalization', 'reflow-native-lifecycle', 'pdf-reflow',
  'community-domain', 'community-data', 'community-provider', 'community-ui', 'community-schema', 'community-social-schema', 'community-clubs-schema', 'community-social', 'community-clubs', 'legal', 'web-build', 'android-build-command',
];
let failures = 0;
for (const name of tests) {
  const start = Date.now();
  const result = spawnSync(process.execPath, [`scripts/test-${name}.cjs`], { encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  const ok = !result.error && result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (${Date.now() - start}ms)`);
  if (!ok) { failures++; console.error((result.error?.message ?? '') + '\n' + (result.stdout ?? '').slice(-4000) + '\n' + (result.stderr ?? '').slice(-4000)); }
}
console.log(`${tests.length - failures}/${tests.length} critical suites passed. Remote/Android/browser results are separate.`);
process.exitCode = failures ? 1 : 0;
