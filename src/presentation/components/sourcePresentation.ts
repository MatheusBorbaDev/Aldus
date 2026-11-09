import { useSyncExternalStore } from 'react';
import { libraryAccountScope } from '@/src/data/library/LibraryAccountScope';
import type { SourceOperationProgress } from '@/src/domain/types/sourceCatalog';
import type { UserSource } from '@/src/domain/types/sources';
const subscribe = (listener: () => void) => libraryAccountScope.subscribe(listener);
const account = () => libraryAccountScope.userId;
const generation = () => libraryAccountScope.generation;
export const useSourceAccountId = () => useSyncExternalStore(subscribe, account, account);
export const useSourceAccountGeneration = () => useSyncExternalStore(subscribe, generation, generation);
export const sourceVisibleInAccount = (source: UserSource, accountId: string | null) => (source.ownerId ?? null) === accountId;
export const sourceLibraryTypeLabel = (kind: UserSource['kind']) => kind === 'google-drive' ? 'Google Drive' : kind === 'json' ? 'Biblioteca por link' : 'Catálogo de pesquisa';
export function sourceProgressLabel(progress: SourceOperationProgress | null | undefined): string | null {
  if (!progress) return null;
  return ({ preparing: 'Preparando conexão…', authorizing: 'Aguardando autorização do Google…', verifying: 'Verificando a pasta…', indexing: 'Buscando livros…', organizing: 'Organizando a biblioteca…', saving: 'Salvando biblioteca…', success: 'Operação concluída.', error: 'A operação não foi concluída.', cancelled: 'Operação cancelada. Seus dados foram preservados.' })[progress.phase];
}
const SHORT_MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
/**
 * Data legível da última atualização de um catálogo, no horário local: "Atualizada hoje às 09:05", "Atualizada ontem às 18:40",
 * "Atualizada em 3 de nov." (mesmo ano) ou "Atualizada em 3 de nov. de 2025". Não depende de Intl (Hermes). Valor ausente → null.
 */
export function sourceUpdatedLabel(timestamp: number | null | undefined, now = Date.now()): string | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp), today = new Date(now);
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (days === 0) return `Atualizada hoje às ${time}`;
  if (days === 1) return `Atualizada ontem às ${time}`;
  const year = date.getFullYear() === today.getFullYear() ? '' : ` de ${date.getFullYear()}`;
  return `Atualizada em ${date.getDate()} de ${SHORT_MONTHS[date.getMonth()]}${year}`;
}
export function sourceProgressCounts(progress: SourceOperationProgress | null | undefined): string | null {
  if (!progress) return null;
  const values: string[] = [];
  if (typeof progress.booksFound === 'number') values.push(`${progress.booksFound.toLocaleString('pt-BR')} ${progress.booksFound === 1 ? 'livro encontrado' : 'livros encontrados'}`);
  if (typeof progress.foldersScanned === 'number') values.push(`${progress.foldersScanned.toLocaleString('pt-BR')} ${progress.foldersScanned === 1 ? 'pasta consultada' : 'pastas consultadas'}`);
  return values.length ? values.join(' · ') : null;
}
