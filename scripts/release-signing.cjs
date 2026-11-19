const path = require('node:path');
const signingKeys = ['ALDUS_SIGNING_STORE_FILE', 'ALDUS_SIGNING_STORE_PASSWORD', 'ALDUS_SIGNING_KEY_ALIAS', 'ALDUS_SIGNING_KEY_PASSWORD'];
function validateReleaseSigning(env, exists) {
  const keys = signingKeys;
  const supplied = keys.filter(key => !!env[key]);
  if (supplied.length && supplied.length !== keys.length) throw Error('Incomplete private signing configuration.');
  if (!supplied.length) {
    if (env.ALDUS_ALLOW_DEVELOPMENT_SIGNING !== 'device-rehearsal') throw Error('Private release signing is required.');
    return 'device-rehearsal';
  }
  if (!path.isAbsolute(env.ALDUS_SIGNING_STORE_FILE) || /(?:^|[\\/])debug\.keystore$/i.test(env.ALDUS_SIGNING_STORE_FILE) || !exists(env.ALDUS_SIGNING_STORE_FILE)) throw Error('A private non-development keystore file is required.');
  return 'private';
}
/** Files written by scripts/create-signing-key.ps1, outside the repository. */
function localSigningFiles(home) {
  const directory = path.join(home, '.aldus-signing');
  return { store: path.join(directory, 'aldus-release.p12'), secret: path.join(directory, 'password.dpapi'), alias: 'aldus' };
}
/** 19/11/2026: when no signing input is given, use the owner's own key from this Windows account.
 * Explicit inputs win; the legacy rehearsal stays an explicit opt-in. The password is never logged. */
function withLocalSigning(env, { home, exists, decrypt }) {
  if (signingKeys.some(key => env[key]) || env.ALDUS_ALLOW_DEVELOPMENT_SIGNING === 'device-rehearsal' || !home) return env;
  const files = localSigningFiles(home);
  if (!exists(files.store) || !exists(files.secret)) return env;
  const password = decrypt(files.secret);
  if (!password) throw Error('The local signing password could not be opened by this Windows account.');
  return { ...env, ALDUS_SIGNING_STORE_FILE: files.store, ALDUS_SIGNING_STORE_PASSWORD: password, ALDUS_SIGNING_KEY_ALIAS: files.alias, ALDUS_SIGNING_KEY_PASSWORD: password };
}
/** Opens the DPAPI file written by create-signing-key.ps1. Only the same Windows account can; the value goes to the caller, never to a log. */
function decryptWindowsSecret(file) {
  if (process.platform !== 'win32') return '';
  const script = '[Console]::OutputEncoding=[Text.Encoding]::UTF8;$s=Get-Content -LiteralPath $env:ALDUS_SIGNING_SECRET_FILE|ConvertTo-SecureString;'
    + '$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))}'
    + 'finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}';
  const read = require('node:child_process').spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', env: { ...process.env, ALDUS_SIGNING_SECRET_FILE: file }, stdio: ['ignore', 'pipe', 'ignore'] });
  return read.status === 0 ? read.stdout : '';
}
module.exports = { validateReleaseSigning, localSigningFiles, withLocalSigning, decryptWindowsSecret };
