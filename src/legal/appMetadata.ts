import Constants from "expo-constants";
import appConfig from "../../app.json";

export function getAppMetadata() {
  const version = Constants.expoConfig?.version || appConfig.expo.version;
  const nativeBuild = Constants.nativeBuildVersion;
  const configuredBuild = Constants.expoConfig?.android?.versionCode ?? appConfig.expo.android.versionCode;
  const build = nativeBuild || (configuredBuild ? String(configuredBuild) : "não informado");
  // Commit da build do APK (18/11/2026): todos os APKs de ensaio mostravam "1.0.0-beta.2 (3)" e não dava para saber no celular qual código
  // estava rodando. O script do APK injeta o commit; "+" marca árvore com mudanças locais. Ausente (Web, Expo Go): null.
  const revision = process.env.EXPO_PUBLIC_BUILD_REVISION;
  return { version, build, revision: typeof revision === "string" && /^[0-9a-f]{7,12}\+?$/.test(revision) ? revision : null };
}
