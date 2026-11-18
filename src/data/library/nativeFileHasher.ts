import type { NativeFileHasher } from "./BookFileIntegrity";

/** Web e testes: sem módulo nativo; a assinatura usa o caminho em JavaScript. O Android usa `nativeFileHasher.native.ts`. */
export const nativeFileHasher: NativeFileHasher | null = null;
