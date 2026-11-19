import { PdfReflowDocument } from "@/src/domain/types/pdfReader";
import type { PdfReflowPreview } from "@/src/data/local/pdfReflowPreview";

export interface PdfReflowProgress {
  stage?: "opening" | "extracting" | "awaiting-ocr" | "ocr" | "building" | "validating" | "finalizing";
  currentPage: number;
  totalPages: number;
  imageCount?: number;
}

export interface PdfReflowProcessorProps {
  uri: string;
  onProgress: (progress: PdfReflowProgress) => void;
  /** `validated`: the processor already ran isValidatedReflowDocumentAsync on this document (18/11/2026: the screen used to repeat it). */
  onComplete: (document: PdfReflowDocument, signal?: AbortSignal, validated?: boolean) => void | Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
  /** The first pages, readable while the rest is prepared (18/11/2026); at most once per preparation. */
  onPreview?: (preview: PdfReflowPreview) => void;
}

export function reflowProgressLabel(progress: PdfReflowProgress) {
  if (progress.stage === "ocr") return progress.totalPages > 0
    ? `Reconhecendo texto: página ${progress.currentPage} de ${progress.totalPages} (${Math.floor(progress.currentPage / progress.totalPages * 100)}%)`
    : "Iniciando reconhecimento de texto...";
  if (progress.stage === "building") return "Montando documento...";
  if (progress.stage === "validating") return "Validando texto extraído...";
  if (progress.stage === "finalizing") return "Finalizando leitura livre...";
  return progress.totalPages > 0
    ? `Extraindo página ${progress.currentPage} de ${progress.totalPages} (${Math.min(99, Math.floor(progress.currentPage / progress.totalPages * 100))}%) · ${progress.imageCount ?? 0} ilustrações`
    : "Abrindo PDF para análise...";
}
