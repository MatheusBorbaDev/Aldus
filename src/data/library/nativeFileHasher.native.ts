import AldusFileHash from "@/modules/aldus-file-hash/index";
import type { NativeFileHasher } from "./BookFileIntegrity";

/** Android: SHA-256 lido em fluxo no Kotlin (`modules/aldus-file-hash`). Ausente num build sem o módulo: volta ao JavaScript. */
export const nativeFileHasher: NativeFileHasher | null = AldusFileHash ?? null;
