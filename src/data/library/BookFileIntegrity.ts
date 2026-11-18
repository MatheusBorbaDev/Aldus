import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { throwIfAborted, withAbort } from '@/src/core/utils/cancellation';
import { nativeFileHasher } from './nativeFileHasher';

/** Módulo nativo de SHA-256 em fluxo (Android, `modules/aldus-file-hash`). */
export interface NativeFileHasher {
  sha256File(uri: string, operationId: number): Promise<{ hash: string; size: number }>;
  cancelOperation(operationId: number): Promise<void>;
}
let nativeOperation = 0;

/**
 * SHA-256 de um arquivo deste aparelho (18/11/2026). No Android o arquivo é lido em fluxo no código nativo, fora da thread de
 * JavaScript; sem o módulo (Web, testes, build antigo) cai no cálculo em JavaScript por blocos. O resultado é o mesmo hash em
 * hexadecimal; o tamanho lido precisa bater com o esperado, senão o arquivo está incompleto.
 */
export async function hashLocalBookFile(uri: string, size: number, readBase64: (position: number, length: number) => Promise<string>,
  signal?: AbortSignal, native: NativeFileHasher | null = nativeFileHasher): Promise<string> {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_PRIVATE_BOOK_SIZE) throw new Error('Arquivo vazio ou maior que o limite de 512 MiB.');
  if (!native) return hashBookFile(size, async (position, length) => base64ToBytes(await readBase64(position, length)), signal);
  throwIfAborted(signal);
  const operationId = ++nativeOperation;
  const cancel = () => { void native.cancelOperation(operationId).catch(() => undefined); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const result = await withAbort(native.sha256File(uri, operationId), signal);
    if (!result || typeof result.hash !== 'string' || !/^[a-f0-9]{64}$/.test(result.hash)) throw new Error('A assinatura do arquivo é inválida.');
    if (result.size !== size) throw new Error('Arquivo incompleto. Tente baixar novamente.');
    return result.hash;
  } finally { signal?.removeEventListener('abort', cancel); }
}

/** Base64 → bytes sem uma função por caractere (Uint8Array.from com callback era o custo maior no JavaScript). */
export function base64ToBytes(encoded: string): Uint8Array {
  const text = atob(encoded), bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
  return bytes;
}

export const BOOK_FILE_CHUNK = 1024 * 1024;
export const MAX_PRIVATE_BOOK_SIZE = 512 * 1024 * 1024;

/** Bounded reads: no extra full-file copy just to calculate a checksum. */
export async function hashBookFile(size: number, read: (offset: number, length: number) => Promise<Uint8Array>, signal?: AbortSignal) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_PRIVATE_BOOK_SIZE) throw new Error('Arquivo vazio ou maior que o limite de 512 MiB.');
  const digest = sha256.create();
  for (let offset = 0; offset < size; offset += BOOK_FILE_CHUNK) {
    throwIfAborted(signal);
    const length = Math.min(BOOK_FILE_CHUNK, size - offset);
    const bytes = await read(offset, length);
    if (bytes.length !== length) throw new Error('Arquivo incompleto. Tente baixar novamente.');
    digest.update(bytes);
    // Let Native handle cancellation and rendering between chunks.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  throwIfAborted(signal);
  return bytesToHex(digest.digest());
}

export function privateBookPath(owner: string, bookId: string, hash: string, format: 'epub' | 'pdf') {
  if (!/^[a-f0-9-]{36}$/.test(owner) || !bookId || bookId.length > 200 || /[/\\]/.test(bookId)
    || ['.','..','__proto__','constructor','prototype'].includes(bookId) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Identidade do arquivo privado inválida.');
  return `${owner}/${bookId}/${hash}.${format}`;
}
