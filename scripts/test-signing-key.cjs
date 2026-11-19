// The owner's signing key: created outside Git, never replaced, password unreadable on disk, picked up by the APK build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { localSigningFiles, withLocalSigning, validateReleaseSigning, decryptWindowsSecret } = require('./release-signing.cjs');

// Loader behaviour, with injected files and decryption.
const home = path.resolve('fixture-home'), files = localSigningFiles(home);
const present = new Set([files.store, files.secret]), exists = file => present.has(file);
const local = withLocalSigning({}, { home, exists, decrypt: () => 'fixture-secret' });
assert.equal(local.ALDUS_SIGNING_STORE_FILE, files.store);
assert.equal(local.ALDUS_SIGNING_KEY_ALIAS, 'aldus');
assert.equal(validateReleaseSigning(local, exists), 'private', 'With the owner key in place, a plain build is privately signed');
const rehearsal = { ALDUS_ALLOW_DEVELOPMENT_SIGNING: 'device-rehearsal' };
assert.equal(withLocalSigning(rehearsal, { home, exists, decrypt: () => assert.fail('rehearsal must not open the key') }), rehearsal, 'Rehearsal stays an explicit choice');
const explicit = { ALDUS_SIGNING_STORE_FILE: 'x' };
assert.equal(withLocalSigning(explicit, { home, exists, decrypt: () => assert.fail() }), explicit, 'Explicit signing inputs win');
assert.deepEqual(withLocalSigning({}, { home, exists: () => false, decrypt: () => assert.fail() }), {}, 'No key: nothing invented');
assert.throws(() => withLocalSigning({}, { home, exists, decrypt: () => '' }), /could not be opened/, 'An unreadable password stops the build');
assert.throws(() => validateReleaseSigning(withLocalSigning({}, { home, exists: () => false, decrypt: () => '' }), () => false), /required/, 'Without any key the release build refuses');

// The real script, in a throwaway home, with a throwaway password (Windows + JDK only).
const keytool = path.join(process.env.JAVA_HOME || 'C:/Program Files/Java/jdk-17', 'bin', 'keytool.exe');
if (process.platform !== 'win32' || !fs.existsSync(keytool)) {
  console.log('PASS signing-key loader. Script run SKIPPED: needs Windows and the JDK 17 keytool.');
  process.exit(0);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aldus-signing-test-'));
const directory = path.join(temp, '.aldus-signing'), created = localSigningFiles(temp);
const throwaway = 'fixture-only-' + crypto.randomBytes(6).toString('hex');
const run = () => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  `& '${path.resolve('scripts/create-signing-key.ps1')}' -Directory $env:FIXTURE_DIR -Password (ConvertTo-SecureString $env:FIXTURE_PASSWORD -AsPlainText -Force)`],
  { encoding: 'utf8', env: { ...process.env, FIXTURE_DIR: directory, FIXTURE_PASSWORD: throwaway } });
try {
  const first = run();
  assert.equal(first.status, 0, 'Key creation succeeds: ' + first.stderr);
  assert(fs.existsSync(created.store) && fs.existsSync(created.secret));
  assert(!first.stdout.includes(throwaway) && !first.stderr.includes(throwaway), 'The password never reaches the output');
  assert(!fs.readFileSync(created.secret, 'utf8').includes(throwaway), 'The password is not stored as plain text');
  assert.equal(decryptWindowsSecret(created.secret), throwaway, 'This Windows account can open it for the build');
  assert.match(first.stdout, /SHA-256\): ([0-9A-F]{2}:){31}[0-9A-F]{2}/, 'The certificate fingerprint is shown');
  const listing = spawnSync(keytool, ['-list', '-v', '-keystore', created.store, '-alias', 'aldus', '-storepass:env', 'FIXTURE_PASSWORD'], { encoding: 'utf8', env: { ...process.env, FIXTURE_PASSWORD: throwaway } });
  assert.equal(listing.status, 0);
  assert.match(listing.stdout, /CN=Aldus Reader, C=BR/, 'The public certificate carries the app name, not personal data');
  assert.match(listing.stdout, /4096-bit RSA/);
  const before = crypto.createHash('sha256').update(fs.readFileSync(created.store)).digest('hex');
  const second = run();
  assert.notEqual(second.status, 0, 'A second run refuses');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(created.store)).digest('hex'), before, 'An existing key is never replaced');
  const build = withLocalSigning({}, { home: temp, exists: fs.existsSync, decrypt: decryptWindowsSecret });
  assert.equal(validateReleaseSigning(build, fs.existsSync), 'private');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log('PASS signing key: created outside Git with the app name, password hidden and DPAPI-protected, never replaced, used by the release build.');
