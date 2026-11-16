import { StoredChapter } from "@/src/domain/entities/LibraryBook";
import { TextReadingAnchor } from "@/src/domain/types/readingAnchor";
import { Highlight } from "@/src/domain/repositories/HighlightRepository";
import { ReaderNavigationOrigin } from "@/src/utils/readerNavigationDiagnostics";

/** `studySelectAt`: pressionar e segurar em (x, y) do documento seleciona a palavra; `studyAdjust`: aumenta/diminui o trecho pelas pontas ou pega a frase. */
export type ReaderStudyAdjust = "growStart" | "growEnd" | "shrinkStart" | "shrinkEnd" | "sentence";
export interface ReaderStudyRequest { id: number; type: "studyCapture" | "studyNavigate" | "studySelection" | "studySelectAt" | "studyAdjust"; anchor?: TextReadingAnchor; enabled?: boolean; x?: number; y?: number; op?: ReaderStudyAdjust }
export interface ReaderStudyResult { id: number; type: "study"; status: "captured" | "exact" | "relocated" | "ambiguous" | "missing" | "error" | "rendered" | "unsupported"; anchor?: TextReadingAnchor; pageNumber?: number; message?: string; missing?: number; ambiguous?: number }

export interface EpubPageInfo {
  pageNumber: number;
  totalPages: number;
  chapterIndex: number;
  chapterTitle: string;
  layoutReady?: boolean;
  readingAnchor?: TextReadingAnchor | null;
  anchorRestoreStatus?: "exact" | "relocated" | "missing" | "ambiguous" | null;
  operationId?: number;
  origin?: ReaderNavigationOrigin;
  currentPage?: number;
  targetPage?: number;
  chapterLocations?: Array<{ chapterIndex: number; pageNumber: number; title: string }>;
}

export type EpubNavigationRequest = {
  id: number;
  origin?: ReaderNavigationOrigin;
} & ({ direction: -1 | 1; pageNumber?: never } | { pageNumber: number; direction?: never });

export interface EpubPageViewerProps {
  chapters: StoredChapter[];
  pageNumber: number;
  initialRestorePending?: boolean;
  restoreTargetReady?: boolean;
  restoreTextAnchor?: TextReadingAnchor | null;
  navigationRequest?: EpubNavigationRequest | null;
  fontSize: number;
  fontFamily: string;
  marginSize: number;
  lineHeight?: number;
  paragraphSpacing?: number;
  maxWidth?: number;
  alignment?: "left" | "justify";
  allowTextSelection?: boolean;
  searchTerm?: string;
  onSearchResult?: (found: boolean) => void;
  textColor: string;
  backgroundColor: string;
  /** Valor de `background-image` da página (textura de papel); `none` ou ausente desliga. Não remonta o documento. */
  pageSurfaceImage?: string;
  onPageInfo: (info: EpubPageInfo) => void;
  studyRequest?: ReaderStudyRequest | null;
  onStudyResult?: (result: ReaderStudyResult) => void;
  studyHighlights?: Highlight[];
}
