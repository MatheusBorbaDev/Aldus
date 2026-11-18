// Drive folder picker (owner's request, 18/11/2026: choose the folder instead of pasting a link).
// Service: real GoogleDriveService.browseFolders with a controlled Drive API. Screen: real DriveFolderPicker with the service mocked.
const assert = require('node:assert/strict');
const { loader } = require('./library-test-utils.cjs');
const React = require('../.expo/auth-test-tools/node_modules/react');
const { act, create } = require('../.expo/auth-test-tools/node_modules/react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const FOLDER = 'application/vnd.google-apps.folder', SHORTCUT = 'application/vnd.google-apps.shortcut';

(async () => {
  // 1. Service.
  const load = loader();
  const { DriveAuthorization } = load('src/data/drive/DriveAuthorization.ts');
  const { GoogleDriveService } = load('src/data/drive/GoogleDriveService.ts');
  const { driveFolderLink, parseDriveFolder } = load('src/data/drive/driveFolder.ts');
  const auth = new DriveAuthorization({ prepare: async () => {}, authorize: async () => ({ accessToken: 'tok', expiresAt: Date.now() + 3600000 }), revoke: async () => {} });
  await auth.connect('draft');
  const seen = [];
  const service = new GoogleDriveService(auth, async (url, options) => {
    const u = new URL(url); seen.push({ q: u.searchParams.get('q'), pageToken: u.searchParams.get('pageToken'), keys: options.headers['X-Goog-Drive-Resource-Keys'], fields: u.searchParams.get('fields') });
    assert.equal(u.searchParams.get('alt'), null, 'never downloads');
    if (u.searchParams.get('pageToken') === 'page-2') return json({ files: [{ id: 'folder_bbbbbbbbbb', name: 'Faculdade', mimeType: FOLDER }] });
    return json({ nextPageToken: 'page-2', files: [
      { id: 'folder_aaaaaaaaaa', name: ' Clássicos ', mimeType: FOLDER, resourceKey: 'rk1' },
      { id: 'shortcut_1', name: 'Atalho para Concursos', mimeType: SHORTCUT, shortcutDetails: { targetId: 'folder_cccccccccc', targetMimeType: FOLDER, targetResourceKey: 'rk2' } },
      { id: 'shortcut_2', name: 'Atalho para um PDF', mimeType: SHORTCUT, shortcutDetails: { targetId: 'file_dddddddddd', targetMimeType: 'application/pdf' } },
      { id: 'book_eeeeeeeeee', name: 'livro.epub', mimeType: 'application/epub+zip' },
      { id: 'folder_aaaaaaaaaa', name: 'Clássicos', mimeType: FOLDER },
      { id: 'bad id with spaces', name: 'Estranha', mimeType: FOLDER },
      { id: 'folder_ffffffffff', name: '   ', mimeType: FOLDER },
    ] });
  });
  const first = await service.browseFolders('draft', { area: 'mine' });
  assert.deepEqual(first, { folders: [{ id: 'folder_aaaaaaaaaa', name: 'Clássicos', resourceKey: 'rk1' }, { id: 'folder_cccccccccc', name: 'Atalho para Concursos', resourceKey: 'rk2' }], nextPageToken: 'page-2' });
  assert.match(seen[0].q, /^'root' in parents and trashed = false and \(mimeType = 'application\/vnd\.google-apps\.folder' or mimeType = 'application\/vnd\.google-apps\.shortcut'\)$/);
  assert.ok(!/size|modifiedTime/.test(seen[0].fields), 'only folder names and ids are requested');
  assert.deepEqual((await service.browseFolders('draft', { area: 'mine' }, 'page-2')).folders.map(f => f.name), ['Faculdade']);
  assert.equal(seen[1].pageToken, 'page-2');
  await service.browseFolders('draft', { area: 'shared' });
  assert.match(seen[2].q, /^sharedWithMe = true and trashed = false/);
  await service.browseFolders('draft', { area: 'mine', folderId: 'folder_aaaaaaaaaa', resourceKey: 'rk1' });
  assert.match(seen[3].q, /^'folder_aaaaaaaaaa' in parents/); assert.equal(seen[3].keys, 'folder_aaaaaaaaaa/rk1');
  for (const place of [{ area: 'mine', folderId: "x' or name contains '" }, { area: 'mine', folderId: 'folder_aaaaaaaaaa', resourceKey: 'bad key' }]) {
    await assert.rejects(service.browseFolders('draft', place), e => e.code === 'invalid-folder', 'no query injection');
  }
  await assert.rejects(service.browseFolders('other-source', { area: 'mine' }), e => e.code === 'disconnected', 'needs this connection');
  const link = driveFolderLink({ folderId: 'folder_aaaaaaaaaa', resourceKey: 'rk1' });
  assert.deepEqual(parseDriveFolder(link), { folderId: 'folder_aaaaaaaaaa', resourceKey: 'rk1' });
  assert.deepEqual(parseDriveFolder(driveFolderLink({ folderId: 'folder_aaaaaaaaaa' })), { folderId: 'folder_aaaaaaaaaa', resourceKey: undefined });
  assert.throws(() => driveFolderLink({ folderId: 'short' }), e => e.code === 'invalid-folder');

  // 2. Screen.
  const calls = [];
  let fail = false, pending = null;
  const pages = {
    'mine:root:': { folders: [{ id: 'folder_aaaaaaaaaa', name: 'Clássicos', resourceKey: 'rk1' }], nextPageToken: 'p2' },
    'mine:root:p2': { folders: [{ id: 'folder_bbbbbbbbbb', name: 'Faculdade' }] },
    'mine:folder_aaaaaaaaaa:': { folders: [] },
    'shared:root:': { folders: [] },
  };
  const { DriveError } = load('src/data/drive/DriveErrors.ts');
  const drive = { browseFolders: async (sourceId, place, pageToken) => {
    calls.push({ sourceId, ...place, pageToken });
    if (pending) await pending;
    if (fail) throw new DriveError('network');
    return pages[`${place.area}:${place.folderId ?? 'root'}:${pageToken ?? ''}`];
  } };
  const palette = { surface: '#fff', surfaceSecondary: '#eee', border: '#ddd', accent: '#a54', text: '#111', secondaryText: '#555', separator: '#eee' };
  const overrides = {
    react: React, 'react/jsx-runtime': require('../.expo/auth-test-tools/node_modules/react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'Spinner', StyleSheet: { create: x => x, hairlineWidth: 1 } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/src/presentation/contexts/AppThemeContext': { useAppTheme: () => ({ palette }) },
    '@/src/data/drive/driveDependencies': { googleDrive: drive },
    '@/src/data/drive/DriveErrors': { DriveError },
  };
  const { DriveFolderPicker } = require('./community-test-loader.cjs')(overrides)('src/presentation/components/DriveFolderPicker.tsx');
  const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join('');
  const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
  const chosen = [];
  let tree; await act(async () => { tree = create(React.createElement(DriveFolderPicker, { sourceId: 'draft', disabled: false, onChoose: f => chosen.push(f) })); }); await flush();
  const button = label => tree.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label);
  const press = async label => { const b = button(label); assert.ok(b, 'missing ' + label); await act(async () => b.props.onPress()); await flush(); };
  assert.ok(text(tree.root).includes('Clássicos'));
  assert.equal(button('Entre em uma pasta para usá-la').props.disabled, true, 'root of the Drive cannot be chosen');
  await press('Carregar mais pastas');
  assert.ok(text(tree.root).includes('Faculdade') && text(tree.root).includes('Clássicos'), 'next page appended');
  await press('Abrir pasta Clássicos');
  assert.deepEqual(calls.at(-1), { sourceId: 'draft', area: 'mine', folderId: 'folder_aaaaaaaaaa', resourceKey: 'rk1', pageToken: undefined });
  assert.ok(text(tree.root).includes('Esta pasta não tem subpastas.'));
  await press('Usar a pasta Clássicos');
  assert.deepEqual(chosen, [{ id: 'folder_aaaaaaaaaa', name: 'Clássicos', resourceKey: 'rk1' }]);
  await press('Voltar para Meu Drive');
  assert.equal(button('Entre em uma pasta para usá-la').props.disabled, true);
  await press('Compartilhados comigo');
  assert.equal(calls.at(-1).area, 'shared'); assert.ok(text(tree.root).includes('Nenhuma pasta foi compartilhada com esta conta.'));
  fail = true; await press('Meu Drive');
  assert.ok(text(tree.root).includes('Não foi possível contatar o Drive'), 'error shown');
  fail = false; await press('Tentar listar as pastas de novo');
  assert.ok(text(tree.root).includes('Clássicos'), 'retry works');
  // A slow answer for an old place never replaces the current one.
  let release; pending = new Promise(r => { release = r; });
  await act(async () => button('Abrir pasta Clássicos').props.onPress());
  await act(async () => button('Voltar para Meu Drive').props.onPress());
  pending = null; release(); await flush();
  assert.ok(text(tree.root).includes('Clássicos') && !text(tree.root).includes('Esta pasta não tem subpastas.'), 'late answer ignored');
  await act(async () => tree.unmount());
  console.log('PASS Drive folder picker: one level of folders and folder shortcuts (files, bad ids and blanks skipped), Meu Drive/Compartilhados comigo/inside a folder with resource keys, pagination, no query injection, link round-trip; screen opens folders, breadcrumb back, root not choosable, load more, error and retry, late answers ignored. Real Drive and device NOT TESTED.');
})().catch(error => { console.error(error); process.exitCode = 1; });
