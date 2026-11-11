import { useEffect, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { BookImportLifecycle } from "@/src/domain/import/BookImportLifecycle";
import { BookImportState, idleBookImportState, isBookImportTerminal } from "@/src/domain/types/bookImport";
import { LibraryBook } from "@/src/domain/entities/LibraryBook";
import { appDependencies } from "@/src/presentation/services/dependencies";
import { importDiagnostic } from "@/src/utils/importDiagnostics";

/** Resposta ao aviso de duplicado: abrir o livro que já existe ou importar outra cópia (cancelar usa `cancel`). */
export type DuplicateImportChoice = "open" | "import" | "cancel";

export function useBookImport(reloadLibrary: () => Promise<void>, openBook?: (bookId: string) => void) {
  const mounted = useRef(true);
  const selectionLocked = useRef(false);
  const [state, setState] = useState<BookImportState>(idleBookImportState);
  const [selecting, setSelecting] = useState(false);
  const [importedBook, setImportedBook] = useState<LibraryBook | null>(null);
  const [duplicate, setDuplicate] = useState<LibraryBook | null>(null);
  const [restored, setRestored] = useState(false);
  const duplicateAnswer = useRef<((choice: DuplicateImportChoice) => void) | null>(null);
  const answerDuplicate = (choice: DuplicateImportChoice) => {
    const answer = duplicateAnswer.current;
    duplicateAnswer.current = null;
    if (mounted.current) setDuplicate(null);
    answer?.(choice);
  };
  const lifecycle = useMemo(() => new BookImportLifecycle(next => {
    if (mounted.current) setState(next);
  }), []);

  useEffect(() => () => {
    mounted.current = false;
    answerDuplicate("cancel");
    lifecycle.reset();
  }, [lifecycle]);

  const start = async () => {
    if (selectionLocked.current || (state.phase !== "idle" && !isBookImportTerminal(state.phase))) return;
    selectionLocked.current = true;
    setImportedBook(null);
    setRestored(false);
    setSelecting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/epub+zip", "application/epub", "application/pdf", "application/octet-stream"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const operation = lifecycle.start({ source: "local", fileName: asset.name, fileSize: asset.size });
      const startedAt = lifecycle.current().startedAt ?? Date.now();
      importDiagnostic({ operationId: operation.operationId, source: "local", phase: "preparing", event: "start", startedAt, fileSize: asset.size, uri: asset.uri });
      try {
        const picked = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, file: asset.file };
        // Fase 1: o mesmo arquivo já importado (SHA-256 no índice local da conta) pede uma decisão antes de importar.
        const duplicateCheck = await appDependencies.importDuplicates.check(picked, operation.signal);
        // Acervo, etapa 2: o mesmo arquivo de um título do acervo antigo volta para o livro que já existe na conta.
        const legacy = await appDependencies.legacyReattach.find(duplicateCheck.hash);
        if (legacy && duplicateCheck.hash) {
          lifecycle.transition(operation.operationId, { phase: "persisting", cancellable: false });
          const book = await appDependencies.legacyReattach.reattach(legacy, picked, duplicateCheck.hash, operation.signal);
          if (!lifecycle.isCurrent(operation.operationId)) return;
          setImportedBook(book);
          setRestored(true);
          lifecycle.succeed(operation.operationId, book.id);
          void appDependencies.importDuplicates.remember(duplicateCheck, book.id).catch(() => undefined);
          void reloadLibrary().catch(() => undefined);
          return;
        }
        if (duplicateCheck.existing) {
          const existing = duplicateCheck.existing;
          const choice = await new Promise<DuplicateImportChoice>(resolve => {
            duplicateAnswer.current = resolve;
            if (mounted.current) setDuplicate(existing);
          });
          if (choice === "cancel" || operation.signal.aborted || !lifecycle.isCurrent(operation.operationId)) return;
          if (choice === "open") {
            lifecycle.reset();
            openBook?.(existing.id);
            return;
          }
        }
        const book = await appDependencies.localBookImporter.import(picked, {
          operationId: operation.operationId,
          signal: operation.signal,
          onPhase: update => {
            if (lifecycle.transition(operation.operationId, update)) {
              importDiagnostic({ operationId: operation.operationId, source: "local", format: lifecycle.current().format, phase: update.phase, event: "phase", startedAt, fileSize: lifecycle.current().fileSize, uri: asset.uri });
            }
          },
        });
        if (!lifecycle.transition(operation.operationId, { phase: "finalizing", cancellable: false })) return;
        setImportedBook(book);
        lifecycle.succeed(operation.operationId, book.id);
        void appDependencies.importDuplicates.remember(duplicateCheck, book.id).catch(() => undefined);
        importDiagnostic({ operationId: operation.operationId, source: "local", format: lifecycle.current().format, phase: "success", event: "success", startedAt, fileSize: lifecycle.current().fileSize, uri: asset.uri });
        void reloadLibrary().catch(() => undefined);
      } catch (error) {
        if (operation.signal.aborted || !lifecycle.isCurrent(operation.operationId) || lifecycle.current().phase === "cancelled") return;
        const message = friendlyImportError(error);
        lifecycle.fail(operation.operationId, message);
        importDiagnostic({ operationId: operation.operationId, source: "local", format: lifecycle.current().format, phase: "error", event: "error", startedAt, fileSize: lifecycle.current().fileSize, uri: asset.uri });
      }
    } catch (error) {
      const operation = lifecycle.start({ source: "local", fileName: "Arquivo selecionado" });
      lifecycle.fail(operation.operationId, friendlyImportError(error));
    } finally {
      selectionLocked.current = false;
      if (mounted.current) setSelecting(false);
    }
  };

  const cancel = () => {
    const current = lifecycle.current();
    if (lifecycle.cancel() && current.operationId && current.startedAt) {
      importDiagnostic({ operationId: current.operationId, source: current.source ?? "local", format: current.format, phase: "cancelled", event: "cancel", startedAt: current.startedAt, fileSize: current.fileSize });
    }
    answerDuplicate("cancel");
  };

  const dismiss = () => {
    if (isBookImportTerminal(lifecycle.current().phase)) {
      lifecycle.reset();
      setImportedBook(null);
      setRestored(false);
    }
  };

  return {
    state,
    selecting,
    importedBook,
    restored,
    duplicate,
    openDuplicate: () => answerDuplicate("open"),
    importDuplicateAnyway: () => answerDuplicate("import"),
    start,
    cancel,
    dismiss,
    busy: selecting || (state.phase !== "idle" && !isBookImportTerminal(state.phase)),
  };
}

function friendlyImportError(error: unknown): string {
  if (!(error instanceof Error)) return "Não foi possível importar este arquivo.";
  if (error.name === "AbortError") return "Importação cancelada.";
  if (/formato não suportado/i.test(error.message)) return error.message;
  if (/não (é|possui).*válid|inválid|corrompid|ZIP EPUB|META-INF|OPF|capítulos legíveis/i.test(error.message)) return `Arquivo inválido: ${error.message}`;
  if (/não encontrado|não foi possível ler|identificar|acess/i.test(error.message)) return `Arquivo inacessível: ${error.message}`;
  if (/armazenamento|biblioteca local|SQLite|IndexedDB|quota/i.test(error.message)) return `Erro de armazenamento: ${error.message}`;
  return error.message || "Não foi possível importar este arquivo.";
}
