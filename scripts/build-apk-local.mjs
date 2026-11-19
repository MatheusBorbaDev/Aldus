import { spawnSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { androidBuildCommand } from "./android-build-command.cjs";
import { validate } from "./validate-web-env.cjs";
import { decryptWindowsSecret, validateReleaseSigning, withLocalSigning } from "./release-signing.cjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const androidDir = path.join(projectRoot, "android");
const isWindows = process.platform === "win32";
const wrapper = path.join(androidDir, isWindows ? "gradlew.bat" : "gradlew");
const apkPath = path.join(androidDir, "app/build/outputs/apk/release/app-release.apk");

// The same public-env guard runs before either Web export or Android embedding.
if (existsSync(path.join(projectRoot, '.env.local'))) process.loadEnvFile(path.join(projectRoot, '.env.local'));
try { validate(process.env); }
catch { console.error('Unsafe public app configuration; values redacted. Build not started.'); process.exit(1); }

// The owner's key (scripts/create-signing-key.ps1) lives outside the repository; its password is DPAPI-protected for this Windows account.
let buildEnv = process.env;
try {
  buildEnv = withLocalSigning(process.env, { home: os.homedir(), exists: existsSync, decrypt: decryptWindowsSecret });
  console.log(`Release signing mode: ${validateReleaseSigning(buildEnv, existsSync)}`);
}
catch (error) { console.error(error.message + ' Build not started; credentials redacted.'); process.exit(1); }

if (!existsSync(wrapper)) {
  console.error("Android project not found. Run npx expo prebuild --platform android first.");
  process.exit(1);
}

// O Gradle não apaga recursos de builds anteriores: livros removidos do projeto voltavam ao APK (11/11/2026). A pasta é saída
// regenerável do bundle JS; apagá-la a cada build garante que o APK só leve o que está no código agora.
rmSync(path.join(androidDir, "app/build/generated/res/react/release"), { recursive: true, force: true });

const buildStarted = Date.now();
const command = androidBuildCommand(wrapper);
const result = spawnSync(
  command.file,
  command.args,
  {
    ...command.options,
    cwd: androidDir,
    stdio: "inherit",
    env: { ...buildEnv, NODE_ENV: process.env.NODE_ENV || "production", EXPO_PUBLIC_BUILD_REVISION: buildRevision() },
  },
);

if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status || 1);
if (!existsSync(apkPath)) {
  console.error(`Gradle finished without producing the expected APK: ${apkPath}`);
  process.exit(1);
}

const apk = statSync(apkPath);
console.log(`APK: ${apkPath}`);
console.log(`Size: ${(apk.size / 1024 / 1024).toFixed(1)} MiB`);
if (apk.mtimeMs < buildStarted) console.log("Gradle reused an up-to-date APK.");

// Pedido do dono (16/11/2026): nenhum APK sai sem tudo o que foi pedido. A lista está em scripts/verify-release-features.cjs.
const features = spawnSync(process.execPath, [path.join(projectRoot, "scripts/verify-release-features.cjs"), "--apk", apkPath], { stdio: "inherit" });
if (features.status !== 0) {
  console.error("APK gerado, mas INCOMPLETO: falta algum recurso pedido (lista acima). Não entregue este arquivo.");
  process.exit(1);
}

/** Commit embutido no app (Ajustes → Versão), com "+" se havia mudanças locais. Sem Git: nada é embutido. */
function buildRevision() {
  const head = spawnSync("git", ["rev-parse", "--short=7", "HEAD"], { cwd: projectRoot, encoding: "utf8" });
  if (head.status !== 0) return "";
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf8" }).stdout.trim() !== "";
  return head.stdout.trim() + (dirty ? "+" : "");
}
