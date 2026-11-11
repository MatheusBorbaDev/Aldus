import { routeForSystemPath } from "@/src/domain/library/incomingFile";

/**
 * Caminhos entregues pelo sistema ao abrir o app (expo-router). Um PDF/EPUB aberto com o Aldus chega como `content://…` e vai para a
 * tela de importação; os demais links (`aldus://…`) seguem como sempre.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return routeForSystemPath(path);
  } catch {
    return path;
  }
}
