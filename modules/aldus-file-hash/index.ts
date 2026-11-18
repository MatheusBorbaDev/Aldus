import { requireOptionalNativeModule } from "expo-modules-core";

/** SHA-256 de um arquivo local lido em fluxo no Android (18/11/2026). `size` em bytes lidos; o hash em hexadecimal minúsculo. */
export interface AldusFileHashModule {
  sha256File(uri: string, operationId: number): Promise<{ hash: string; size: number }>;
  cancelOperation(operationId: number): Promise<void>;
}

export default requireOptionalNativeModule<AldusFileHashModule>("AldusFileHash");
