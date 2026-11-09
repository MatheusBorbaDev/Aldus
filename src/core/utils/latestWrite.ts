/**
 * Acompanha gravações de preferências feitas em sequência e informa se a MAIS RECENTE falhou. Um resultado antigo que chega
 * atrasado não apaga nem cria um aviso sobre a gravação atual (revisão de qualidade, onda 5). Não repete, não adia e não
 * descarta a gravação: só torna a falha visível em vez de engoli-la com `.catch(() => undefined)`.
 */
export function latestWriteTracker(onResult: (failed: boolean) => void) {
  let revision = 0;
  return (write: Promise<unknown>): void => {
    const current = ++revision;
    write.then(
      () => { if (current === revision) onResult(false); },
      () => { if (current === revision) onResult(true); },
    );
  };
}
