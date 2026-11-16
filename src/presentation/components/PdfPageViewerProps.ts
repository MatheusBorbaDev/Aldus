import { PdfFitMode } from "@/src/domain/types/pdfReader";
import type { PdfFlow } from "@/src/domain/reader/pdfScroll";

export type PdfPageMode = "single" | "double";

export function getPdfPageMode(fileName: string): PdfPageMode {
  return fileName.toLowerCase() === "weber-etica.pdf" ? "double" : "single";
}

export interface PdfPageViewerProps {
  uri: string;
  pageNumber: number;
  pageMode: PdfPageMode;
  fitMode: PdfFitMode;
  zoom: number;
  rotation: number;
  onTotalPages: (totalPages: number) => void;
  /** Rolagem contínua (Fase E). Ausente = página a página. */
  flow?: PdfFlow;
  /** Página no topo da tela quando a rolagem para (só na rolagem contínua). */
  onScrollPage?: (pageNumber: number, offset: number) => void;
  /** Toque sem arrastar sobre a página (só na rolagem contínua, onde não há zonas de toque). */
  onTap?: () => void;
}