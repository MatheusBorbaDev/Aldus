import { MotionCuesOverlay } from "@/src/presentation/components/MotionCuesOverlay";
import { StudyBookmarksPanel } from "@/src/presentation/components/StudyBookmarksPanel";
import { ReadingAnchor, TextReadingAnchor, parseReadingAnchor } from "@/src/domain/types/readingAnchor";
import { decodeReaderLocation, encodeReaderLocation } from "@/src/domain/types/readerLocation";
import { ReaderStudyRequest, ReaderStudyResult } from "@/src/presentation/components/EpubPageViewerProps";
import { Highlight } from "@/src/domain/repositories/HighlightRepository";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { latestWriteTracker } from "@/src/core/utils/latestWrite";
import { useNativeReaderBrightness } from "@/src/presentation/hooks/useNativeReaderBrightness";
import { useChapterTimeLeft } from "@/src/presentation/hooks/useChapterTimeLeft";
import { openSystemDoNotDisturb, useReadingSession } from "@/src/presentation/hooks/useReadingSession";
import { ReadingMilestonesModal } from "@/src/presentation/components/reader/ReadingMilestonesModal";
import { FocusCardModal } from "@/src/presentation/components/reader/FocusCardModal";
import { MilestonePlan, milestoneLabel, milestoneScheduleText } from "@/src/domain/reader/readingMilestones";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { useReadAloud } from "@/src/presentation/hooks/useReadAloud";
import { htmlToSpeechText, speechStartOffset } from "@/src/domain/reader/speechText";
import { chapterLanguage } from "@/src/presentation/components/EpubReaderDocument";
import { ReaderFeedbackBanner } from "@/src/presentation/components/reader/ReaderFeedbackBanner";

import { readableBookTitle } from "@/src/presentation/services/bookDisplay";

/** Confirmação passageira: some sozinha. Avisos de falha/âncora continuam até o leitor fechar. */
const REFLOW_READY_MESSAGE = "Leitura livre pronta.";
const TRANSIENT_FEEDBACK_MS = 4000;
const PDF_SETTINGS_SAVE_ERROR = "Não foi possível salvar os ajustes deste PDF. Eles valem até você fechar o livro.";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  estimateCharactersPerPage,
  estimatePageNumber,
  estimateTotalPages,
} from "@/src/core/utils/pagination";
import { useReaderSettings } from "@/src/presentation/contexts/ReaderSettingsContext";
import { useReaderStore } from "@/src/presentation/stores/readerStore";
import { ReaderControls } from "@/src/presentation/components/ReaderControls";
import { ReaderSettingsPanel } from "@/src/presentation/components/ReaderSettingsPanel";
import { DocumentReaderAdapter } from "@/src/presentation/components/reader/DocumentReaderAdapter";
import { documentSafeInsets, readerFeedbackTop } from "@/src/presentation/components/reader/ReaderGeometry";
import { readerUiDiagnostic, ReaderUiContext } from "@/src/utils/readerUiDiagnostics";
import { readerNavigationDiagnostic, ReaderNavigationOrigin } from "@/src/utils/readerNavigationDiagnostics";
import { EpubNavigationRequest, EpubPageInfo } from "@/src/presentation/components/EpubPageViewerProps";
import { getPdfPageMode, PdfPageMode } from "@/src/presentation/components/PdfPageViewerProps";
import { PdfModeChooser } from "@/src/presentation/components/PdfModeChooser";
import { PdfReflowProcessor } from "@/src/presentation/components/PdfReflowProcessor";
import { toStoredReflowChaptersAsync } from "@/src/data/local/PdfReflowDocumentBuilder";
import { isValidatedReflowDocumentAsync } from "@/src/data/local/pdfReflowQuality";
import { throwIfAborted } from "@/src/core/utils/cancellation";
import {
  defaultPdfReaderSettings,
  PDF_REFLOW_PROCESSOR_VERSION,
  PdfReaderSettings,
  PdfReaderTheme,
  PdfReadingMode,
  PdfReflowDocument,
} from "@/src/domain/types/pdfReader";
import { fontFamilies, pdfReaderThemes } from "@/src/theme/tokens";
import { appDependencies } from "@/src/presentation/services/dependencies";
import { LibraryBook, StoredChapter } from "@/src/domain/entities/LibraryBook";
import {
  epubDiagnosticConsole as console,
  markEpubOpenEvent,
  markEpubOpenSpanEnd,
  markEpubOpenSpanStart,
} from "@/src/utils/epubOpenMetrics";

interface Props {
  bookId: string;
}

export function ReaderScreen({ bookId }: Props) {
  const renderCount = useRef(0);
  const reflowModeGeneration = useRef(0);
  const reflowPublication = useRef<AbortController | null>(null);
  const reflowSourceSignature = useRef<string | null>(null);
  useEffect(() => { reflowModeGeneration.current++; reflowSourceSignature.current = null; return () => { reflowModeGeneration.current++; reflowPublication.current?.abort(); reflowSourceSignature.current = null; }; }, [bookId]);
  renderCount.current++;
  const insets = useSafeAreaInsets();
  const settings = useReaderSettings();
  const { width, height } = useWindowDimensions();
  const { progress, controlsVisible, setProgress, setControlsVisible, toggleControls } = useReaderStore();
  const [readerPanel, setReaderPanel] = useState<"appearance" | "contents" | "search" | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [studyVisible, setStudyVisible] = useState(false);
  const [studyAnchor, setStudyAnchor] = useState<ReadingAnchor | null>(null);
  const [studyRequest, setStudyRequest] = useState<ReaderStudyRequest | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyFeedback, setStudyFeedback] = useState<string | null>(null);
  const [studySelecting, setStudySelecting] = useState(false);
  const studySelectionIntent = useRef(false);
  const [studySelectionCaptured, setStudySelectionCaptured] = useState(false);
  const [studyHighlights, setStudyHighlights] = useState<Highlight[]>([]);
  const [studyRenderFeedback, setStudyRenderFeedback] = useState<string | null>(null);
  const [studyStorageError, setStudyStorageError] = useState<string | null>(null);
  const reloadHighlights = useCallback(async () => { setStudyHighlights(await appDependencies.highlightRepository.listByBookId(bookId)); setStudyStorageError(null); }, [bookId]);
  useEffect(() => { let active = true; setStudyHighlights([]); appDependencies.highlightRepository.listByBookId(bookId).then(values => { if (active) { setStudyHighlights(values); setStudyStorageError(null); } }).catch(e => { if (active) setStudyStorageError(e.message); }); return () => { active = false; }; }, [bookId]);
  useEffect(() => { studySequence.current++; studySelectionIntent.current = false; setStudySelectionCaptured(false); setStudyAnchor(null); setStudyRequest(null); setStudyVisible(false); setStudySelecting(false); setStudyLoading(false); setStudyFeedback(null); setStudyRenderFeedback(null); }, [bookId]);
  const studySequence = useRef(0);
  const handleStudyResult = useCallback((result: ReaderStudyResult) => {
    if (result.id === -1) {
      setStudyRenderFeedback(result.status === "unsupported" || result.status === "error" ? result.message ?? "Grifos visuais indisponíveis neste motor." : (result.missing || result.ambiguous) ? `${result.missing ?? 0} grifos sem trecho e ${result.ambiguous ?? 0} ambíguos. As notas continuam disponíveis; não foram reposicionadas.` : null);
      return;
    }
    if (result.id !== studySequence.current) return;
    setStudyLoading(false);
    if (result.status === "captured" && result.anchor) {
      try { setStudyAnchor(parseReadingAnchor(result.anchor)); setStudySelectionCaptured(studySelectionIntent.current); setStudyFeedback(null); setStudySelecting(false); setStudyVisible(true); setStudyRequest({ id: result.id, type: "studySelection", enabled: false }); }
      catch { setStudyFeedback("A localização recebida não é válida. Capture novamente."); }
    } else if (result.status === "exact" || result.status === "relocated") {
      setStudyVisible(false); setStudyFeedback(null);
    } else setStudyFeedback(result.status === "ambiguous" ? "Há mais de um trecho correspondente. A nota permanece disponível; o leitor não foi movido." : result.status === "missing" ? "O trecho não foi encontrado nesta edição. A nota permanece disponível." : result.message ?? "Não foi possível localizar o trecho.");
  }, []);
  useEffect(() => {
    if (!studyLoading) return;
    const timer = setTimeout(() => { setStudyLoading(false); setStudyFeedback("O leitor não respondeu. Aguarde o carregamento e tente novamente."); }, 5000);
    return () => clearTimeout(timer);
  }, [studyLoading, studyRequest]);
  const [chapters, setChapters] = useState<StoredChapter[]>([]);
  const [bookTitle, setBookTitle] = useState("The Quiet Hour");
  const [bookMimeType, setBookMimeType] = useState("application/epub+zip");
  const [bookFilePath, setBookFilePath] = useState<string | null>(null);
  const [currentBook, setCurrentBook] = useState<LibraryBook | null>(null);
  const [pdfSettingsBookId, setPdfSettingsBookId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState("Abrindo livro...");
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfPageMode, setPdfPageMode] = useState<PdfPageMode>("single");
  const [pdfReaderSettings, setPdfReaderSettings] = useState<PdfReaderSettings | null>(null);
  // Livro cuja última gravação dos ajustes do PDF falhou (aviso no painel; os ajustes seguem valendo em memória). Onda 5.
  const [pdfSettingsSaveFailedBookId, setPdfSettingsSaveFailedBookId] = useState<string | null>(null);
  const trackPdfSettingsSave = useMemo(() => latestWriteTracker(failed => setPdfSettingsSaveFailedBookId(failed ? bookId : null)), [bookId]);
  const [pdfReflowDocument, setPdfReflowDocument] = useState<PdfReflowDocument | null>(null);
  const [pdfReflowChapters, setPdfReflowChapters] = useState<StoredChapter[]>([]);
  const [reflowRestoreState, setReflowRestoreState] = useState<"inactive" | "pending" | "applying">("inactive");
  const [restoreTextAnchor, setRestoreTextAnchor] = useState<TextReadingAnchor | null>(null);
  const persistedLocation = useRef<string | null>(null);
  const lastProgressWrite = useRef<string | null>(null);
  const positionRestoreFailed = useRef(false);
  const [reflowPreparing, setReflowPreparing] = useState(false);
  const [reflowProgress, setReflowProgress] = useState({ currentPage: 0, totalPages: 0 });
  const [pdfModeChooserVisible, setPdfModeChooserVisible] = useState(false);
  const [reflowFeedback, setReflowFeedback] = useState<string | null>(null);
  const transientFeedback = reflowFeedback === REFLOW_READY_MESSAGE;
  useEffect(() => {
    if (!transientFeedback) return;
    const timer = setTimeout(() => setReflowFeedback(current => current === REFLOW_READY_MESSAGE ? null : current), TRANSIENT_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [transientFeedback]);
  const [epubPage, setEpubPageRaw] = useState(1);
  const setEpubPage = useCallback((page: number | ((prev: number) => number)) => {
    const invocationStack = new Error().stack?.split("\n").slice(1, 6).join(" | ");
    setEpubPageRaw((prev) => {
      const next = typeof page === 'function' ? page(prev) : page;
      if (next !== prev) console.log(`[FORENSIC:setEpubPage] t=${performance.timeOrigin + performance.now()} ${prev} -> ${next} invocationStack=${invocationStack}`);
      return next;
    });
  }, []);
  const [epubNavigationRequest, setEpubNavigationRequest] = useState<EpubNavigationRequest | null>(null);
  const epubNavigationRequestId = useRef(0);
  const requestedNavigationId = useRef(0);
  const acceptedNavigationId = useRef(0);
  const [requestedPage, setRequestedPage] = useState<number | null>(null);
  const [epubTotalPages, setEpubTotalPagesRaw] = useState(0);
  const setEpubTotalPages = useCallback((total: number | ((prev: number) => number)) => {
    const invocationStack = new Error().stack?.split("\n").slice(1, 6).join(" | ");
    setEpubTotalPagesRaw((prev) => {
      const next = typeof total === 'function' ? total(prev) : total;
      if (next !== prev) console.log(`[FORENSIC:setEpubTotalPages] t=${performance.timeOrigin + performance.now()} ${prev} -> ${next} invocationStack=${invocationStack}`);
      return next;
    });
  }, []);
  const [epubChapterIndex, setEpubChapterIndex] = useState(0);
  const [chapterLocations, setChapterLocations] = useState<NonNullable<EpubPageInfo["chapterLocations"]>>([]);
  const [bookSearchText, setBookSearchText] = useState("");
  const [bookSearchTerm, setBookSearchTerm] = useState("");
  const [bookSearchResult, setBookSearchResult] = useState<boolean | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const initialPdfProgress = useRef(0);
  const initialEpubProgress = useRef<number | null>(null);
  const reflowRestoreTarget = useRef<{ page: number; totalPages: number } | null>(null);
  const [bookStatus, setBookStatus] = useState<"loading" | "ready" | "error">("loading");
  const previousControlsVisible = useRef(controlsVisible);
  console.log(`[FORENSIC:ReaderScreen] t=${performance.timeOrigin + performance.now()} render #${renderCount.current} bookId=${bookId} status=${bookStatus} controlsVisible=${controlsVisible} epubPage=${epubPage} epubTotalPages=${epubTotalPages} progress=${progress} initialEpubProgress=${initialEpubProgress.current}`);

  const handleToggleControls = useCallback(() => {
    const before = useReaderStore.getState().controlsVisible;
    console.log(`[FORENSIC:toggleControls] t=${performance.timeOrigin + performance.now()} invoked before=${before} epubPage=${epubPage}`);
    toggleControls();
    const after = useReaderStore.getState().controlsVisible;
    readerNavigationDiagnostic("CONTROLS_TOGGLE", { operationId: requestedNavigationId.current, confirmedPage: epubPage, currentPage: epubPage, totalPages: epubTotalPages, requestedPage, controlsVisible: after, sliderDragging: false });
    console.log(`[FORENSIC:toggleControls] t=${performance.timeOrigin + performance.now()} returned after=${after} epubPage=${epubPage}`);
  }, [epubPage, epubTotalPages, requestedPage, toggleControls]);

  useEffect(() => {
    if (previousControlsVisible.current !== controlsVisible) {
      console.log(`[FORENSIC:controlsVisible] t=${performance.timeOrigin + performance.now()} ${previousControlsVisible.current} -> ${controlsVisible} epubPage=${epubPage}`);
      previousControlsVisible.current = controlsVisible;
    }
  }, [controlsVisible, epubPage]);

  useEffect(() => {
    console.log(`[FORENSIC:book-open-effect] t=${performance.timeOrigin + performance.now()} bookId=${bookId}`);
    setPdfPage(1);
    setPdfTotalPages(0);
    setPdfReaderSettings(null);
    setPdfSettingsBookId(null);
    setPdfReflowDocument(null);
    setReflowRestoreState("inactive");
    reflowRestoreTarget.current = null;
    setReflowPreparing(false);
    setPdfModeChooserVisible(false);
    setReflowFeedback(null);
    setEpubPage(1);
    setEpubNavigationRequest(null);
    requestedNavigationId.current = 0;
    acceptedNavigationId.current = 0;
    setRequestedPage(null);
    setEpubTotalPages(0);
    setEpubChapterIndex(0);
    setChapterLocations([]);
    setBookSearchText("");
    setBookSearchTerm("");
    setBookSearchResult(null);
    setReaderPanel(null);
    initialEpubProgress.current = null;
    setControlsVisible(false);
  }, [bookId, setControlsVisible]);

  useEffect(() => {
    let active = true;
    const downloadController=new AbortController();
    let objectUrl: string | null = null;
    setBookStatus("loading");
    setBookError(null);

    const initialReadStartedAt = markEpubOpenSpanStart("initial_book_and_chapter_read");
    void appDependencies.openBook.execute(bookId,downloadController.signal)
      .then(async (result) => {
        markEpubOpenSpanEnd("initial_book_and_chapter_read", initialReadStartedAt, {
          found: Boolean(result),
          storedChapterCount: result?.chapters.length ?? 0,
          processedChapterCache: Boolean(result?.chapters.length),
        });
        if (!active || !result) return result;
        if (
          result.book.filePath.startsWith("bundled-epub://") &&
          result.chapters.length === 0
        ) {
          const resolveStartedAt = markEpubOpenSpanStart("asset_resolution", {
            bookId: result.book.id,
            fileName: result.book.fileName,
          });
          const uri = await appDependencies.bundledEpubCatalog.resolveUri(result.book.id);
          markEpubOpenSpanEnd("asset_resolution", resolveStartedAt, {
            uriScheme: uri.split(":", 1)[0],
          });
          await appDependencies.epubImporter.importFromUri(
            uri,
            result.book.fileName,
            undefined,
            result.book.id
          );
          const secondReadStartedAt = markEpubOpenSpanStart("second_book_and_chapter_read");
          const reopened = await appDependencies.openBook.execute(bookId);
          markEpubOpenSpanEnd("second_book_and_chapter_read", secondReadStartedAt, {
            found: Boolean(reopened),
            storedChapterCount: reopened?.chapters.length ?? 0,
          });
          return reopened;
        }
        return result;
      })
      .then(async (result) => {
        if (!active) return;
        if (!result) {
          setBookError("Livro não encontrado na biblioteca.");
          setBookStatus("error");
          return;
        }

        let filePath = result.book.filePath;
        if (filePath.startsWith("web-epub://")) {
          if (Platform.OS !== "web") throw new Error("O EPUB salvo no navegador não está disponível neste dispositivo.");
          const file = await appDependencies.webBookFileStore.get(result.book.id);
          if (!file) throw new Error("O arquivo EPUB salvo neste navegador não foi encontrado.");
          objectUrl = URL.createObjectURL(file);
          filePath = objectUrl;
        } else if (filePath.startsWith("bundled-pdf://")) {
          filePath = await appDependencies.bundledPdfCatalog.resolveUri(result.book.id);
        } else if (filePath.startsWith("web-pdf://")) {
          if (Platform.OS !== "web") throw new Error("O PDF salvo no navegador não está disponível neste dispositivo.");
          const file = await appDependencies.webBookFileStore.get(result.book.id);
          if (!file) throw new Error("O arquivo PDF salvo neste navegador não foi encontrado.");
          objectUrl = URL.createObjectURL(file);
          filePath = objectUrl;
        }

        if (!active) return;

        const isPdfBook = result.book.mimeType === "application/pdf";
        const isEpubBook = result.book.mimeType === "application/epub+zip";
        persistedLocation.current = result.progress?.cfiPosition ?? null;
        lastProgressWrite.current = null;
        positionRestoreFailed.current = false;
        let restoredProgress =
          result.progress?.percentage ?? (isPdfBook || isEpubBook ? 0 : 0.38);
        console.log(`[FORENSIC:restoreProgress] t=${performance.timeOrigin + performance.now()} bookId=${result.book.id} progress=${restoredProgress} epub=${isEpubBook}`);
        let startsInReflow = false;

        if (isPdfBook) {
          const savedSettings = await appDependencies.pdfReaderSettings.get(result.book.id);
          if (!active) return;
          const nextSettings = {
            ...defaultPdfReaderSettings,
            layout: getPdfPageMode(result.book.fileName),
            ...savedSettings,
          };
          restoredProgress = nextSettings.mode === "reflow"
            ? nextSettings.reflowProgress ?? restoredProgress
            : nextSettings.originalProgress ?? restoredProgress;
          setPdfReaderSettings(nextSettings);
          setPdfPageMode(nextSettings.layout);
          setPdfModeChooserVisible(!savedSettings);
          setPdfReflowDocument(null);
          setPdfReflowChapters([]);
          setReflowPreparing(false);
          setReflowFeedback(null);

          if (savedSettings?.mode === "reflow") {
            startsInReflow = true;
            const sourceSignature = await getPdfSourceSignature(result.book, downloadController.signal);
            if (!active) return;
            reflowSourceSignature.current = sourceSignature;
            const cached = await appDependencies.pdfReflowCache
              .findByBookId(result.book.id)
              .catch(() => null);
            if (!active) return;
            if (
              cached &&
              cached.processorVersion === PDF_REFLOW_PROCESSOR_VERSION &&
              cached.sourceSignature === sourceSignature &&
              await isValidatedReflowDocumentAsync(cached.document, downloadController.signal) &&
              cached.document.classification !== "image-based"
            ) {
              const prepared = await toStoredReflowChaptersAsync(result.book.id, cached.document, downloadController.signal);
              if (!active) return;
              setPdfReflowChapters(prepared);
              setPdfReflowDocument(cached.document);
            } else if (cached && cached.processorVersion === PDF_REFLOW_PROCESSOR_VERSION && cached.sourceSignature === sourceSignature && cached.document.classification === "image-based") {
              const originalSettings = { ...nextSettings, mode: "original" as const };
              restoredProgress = originalSettings.originalProgress ?? result.progress?.percentage ?? 0;
              setPdfReaderSettings(originalSettings);
              setReflowFeedback("O Reflow requer OCR para este PDF. O arquivo original continua disponível.");
              startsInReflow = false;
            } else {
              setReflowPreparing(true);
            }
          }
          setPdfSettingsBookId(result.book.id);
        } else {
          setPdfReaderSettings(null);
          setPdfSettingsBookId(null);
          setPdfReflowDocument(null);
          setPdfModeChooserVisible(false);
          setReflowPreparing(false);
        }
        setCurrentBook(result.book);
        setRestoreTextAnchor(decodeReaderLocation(persistedLocation.current, isEpubBook ? "epub" : "pdf-reflow"));

        initialPdfProgress.current = restoredProgress;
        initialEpubProgress.current = isEpubBook || startsInReflow ? restoredProgress : null;
        setReflowRestoreState(isEpubBook || startsInReflow ? "pending" : "inactive");
        reflowRestoreTarget.current = null;

        setPdfPage(1);
        setPdfTotalPages(0);
        setEpubPage(1);
        setEpubTotalPages(0);
        setBookTitle(readableBookTitle(result.book));
        setBookMimeType(result.book.mimeType);
        setPdfPageMode(getPdfPageMode(result.book.fileName));
        setBookFilePath(filePath);
        setChapters(result.chapters);
        setChapterTitle(result.chapters[0]?.title ?? "Documento");
        setProgress(restoredProgress);
        setBookStatus("ready");
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setBookError(
          failure instanceof Error
            ? failure.message
            : "Não foi possível carregar o arquivo deste livro."
        );
        setBookStatus("error");
      });

    return () => {
      active = false;
      downloadController.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, setProgress]);

  const totalCharacters = useMemo(
    () => chapters.reduce((total, chapter) => total + chapter.characterCount, 0),
    [chapters]
  );

  const isEpub = bookMimeType === "application/epub+zip";
  const isPdf = bookMimeType === "application/pdf";
  const pdfReadingMode: PdfReadingMode = pdfReaderSettings?.mode ?? "original";
  const isReflowPdf = isPdf && pdfReadingMode === "reflow";
  const readerChapterItems = useMemo(() => {
    const source = isEpub ? chapters : isReflowPdf ? pdfReflowChapters : [];
    const seenTitles = new Set<string>();
    return source.flatMap((chapter, index) => {
      const title = chapter.title.trim() || `Capítulo ${index + 1}`;
      const normalizedTitle = title.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
      if (seenTitles.has(normalizedTitle)) return [];
      seenTitles.add(normalizedTitle);
      return [{ index, title }];
    });
  }, [chapters, isEpub, isReflowPdf, pdfReflowChapters]);

  useEffect(() => {
    if (!isPdf || !pdfReaderSettings || pdfSettingsBookId !== bookId) return;
    trackPdfSettingsSave(appDependencies.pdfReaderSettings.save(bookId, pdfReaderSettings));
  }, [bookId, isPdf, pdfReaderSettings, pdfSettingsBookId, trackPdfSettingsSave]);

  const handlePdfSettingsChange = useCallback((nextSettings: PdfReaderSettings) => {
    setPdfReaderSettings(nextSettings);
    setPdfPageMode(nextSettings.layout);
  }, []);

  const returnToOriginal = useCallback((message?: string) => {
    reflowPublication.current?.abort();
    const originalProgress = pdfReaderSettings?.originalProgress ?? initialPdfProgress.current;
    initialPdfProgress.current = originalProgress;
    setProgress(originalProgress);
    setReflowPreparing(false);
    setReflowRestoreState("inactive");
    reflowRestoreTarget.current = null;
    initialEpubProgress.current = null;
    setPdfReflowDocument(null);
    setPdfReflowChapters([]);
    setPdfReaderSettings(current => ({ ...(current ?? defaultPdfReaderSettings), mode: "original" }));
    if (message) setReflowFeedback(message);
  }, [pdfReaderSettings, setProgress]);

  const handlePdfModeChange = useCallback(async (mode: PdfReadingMode) => {
    reflowPublication.current?.abort();
    const preparation = new AbortController();
    reflowPublication.current = preparation;
    reflowSourceSignature.current = null;
    const generation = ++reflowModeGeneration.current;
    setEpubNavigationRequest(null);
    setRequestedPage(null);
    requestedNavigationId.current = 0;
    acceptedNavigationId.current = 0;
    setPdfModeChooserVisible(false);
    setReflowFeedback(null);
    const nextSettings = { ...(pdfReaderSettings ?? defaultPdfReaderSettings), mode };
    setPdfReaderSettings(nextSettings);
    if (mode === "original" || !currentBook) {
      initialEpubProgress.current = null;
      setReflowRestoreState("inactive");
      reflowRestoreTarget.current = null;
      const originalProgress = nextSettings.originalProgress ?? progress;
      initialPdfProgress.current = originalProgress;
      setProgress(originalProgress);
      setPdfPage((current) => (current > 0 ? current : 1));
      setReflowPreparing(false);
      setPdfReflowDocument(null);
      return;
    }
    const reflowProgress = nextSettings.reflowProgress ?? progress;
    setRestoreTextAnchor(decodeReaderLocation(persistedLocation.current, "pdf-reflow"));
    initialEpubProgress.current = reflowProgress;
    setReflowRestoreState("pending");
    reflowRestoreTarget.current = null;
    setProgress(reflowProgress);
    setEpubPage(1);
    setEpubTotalPages(0);

    try {
      const sourceSignature = await getPdfSourceSignature(currentBook, preparation.signal);
      if (generation !== reflowModeGeneration.current || preparation.signal.aborted) return;
      reflowSourceSignature.current = sourceSignature;
      const cached = await appDependencies.pdfReflowCache.findByBookId(currentBook.id).catch(() => null);
      if (generation !== reflowModeGeneration.current) return;
      if (cached && cached.processorVersion === PDF_REFLOW_PROCESSOR_VERSION &&
          cached.sourceSignature === sourceSignature &&
          await isValidatedReflowDocumentAsync(cached.document, preparation.signal)) {
        if (cached.document.classification === "image-based") {
          returnToOriginal("O Reflow requer OCR para este PDF. O arquivo original continua disponível.");
        } else {
          const prepared = await toStoredReflowChaptersAsync(currentBook.id, cached.document, preparation.signal);
          if (generation !== reflowModeGeneration.current || preparation.signal.aborted) return;
          setPdfReflowChapters(prepared);
          setPdfReflowDocument(cached.document);
        }
        setReflowPreparing(false);
        return;
      }
      setPdfReflowDocument(null);
      setPdfReflowChapters([]);
      setReflowProgress({ currentPage: 0, totalPages: 0 });
      setReflowPreparing(true);
    } catch {
      if (!preparation.signal.aborted && generation === reflowModeGeneration.current) {
        returnToOriginal("Não foi possível abrir o cache Reflow. O PDF Original continua disponível.");
      }
    }
  }, [currentBook, pdfReaderSettings, pdfTotalPages, progress, returnToOriginal]);

  const handleReflowProgress = useCallback((nextProgress: { currentPage: number; totalPages: number }) => {
    setReflowProgress(nextProgress);
  }, []);

  const handleReflowComplete = useCallback(async (document: PdfReflowDocument, signal?: AbortSignal) => {
    const generation = reflowModeGeneration.current;
    const publication = new AbortController();
    reflowPublication.current?.abort();
    reflowPublication.current = publication;
    const abort = () => publication.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    try {
      if (!await isValidatedReflowDocumentAsync(document, publication.signal) || document.classification === "image-based" || document.characterCount < 1 || document.chapters.length === 0) {
        returnToOriginal(document.classification === "image-based" ? "O Reflow requer OCR para este PDF. Você voltou ao PDF Original." : "O texto extraído não pôde ser validado. Você voltou ao PDF Original.");
        return;
      }
      if (!currentBook) throw new Error("O livro não está mais disponível.");
      const sourceSignature = reflowSourceSignature.current ?? await getPdfSourceSignature(currentBook, publication.signal);
      const prepared = await toStoredReflowChaptersAsync(currentBook.id, document, publication.signal);
      await appDependencies.pdfReflowCache.save({
        id: currentBook.id,
        sourceSignature,
        processorVersion: PDF_REFLOW_PROCESSOR_VERSION,
        document,
        updatedAt: Date.now(),
      }, publication.signal);
      throwIfAborted(publication.signal);
      if (generation !== reflowModeGeneration.current) return;
      setPdfReflowChapters(prepared);
      setPdfReflowDocument(document);
      setPdfReaderSettings(current => ({ ...(current ?? defaultPdfReaderSettings), mode: "reflow" }));
      setReflowFeedback(REFLOW_READY_MESSAGE);
      setReflowPreparing(false);
    } catch (error) {
      if (!publication.signal.aborted && generation === reflowModeGeneration.current) {
        returnToOriginal("Não foi possível confirmar o cache da leitura livre. O PDF Original e o cache anterior foram preservados.");
        throw error;
      }
    } finally { signal?.removeEventListener("abort", abort); }
  }, [currentBook, pdfReaderSettings, returnToOriginal]);

  const handleReflowError = useCallback((message: string) => {
    reflowModeGeneration.current++;
    returnToOriginal(`Não foi possível preparar este PDF para leitura livre. Você voltou ao PDF Original. ${message}`);
  }, [returnToOriginal]);

  const handleCancelReflow = useCallback(() => {
    reflowModeGeneration.current++;
    returnToOriginal();
  }, [returnToOriginal]);

  useEffect(() => {
    if (Platform.OS === "web" || !reflowPreparing) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { handleCancelReflow(); return true; });
    return () => listener.remove();
  }, [reflowPreparing, handleCancelReflow]);

  const handleToggleFullscreen = useCallback(() => {
    if (Platform.OS !== "web") return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  const charactersPerPage = estimateCharactersPerPage({
    totalCharacters,
    width,
    height,
    fontSize: settings.fontSize,
    lineHeight: settings.fontSize * 1.65,
    margin: settings.marginSize,
  });

  const totalPages = estimateTotalPages(totalCharacters, charactersPerPage);
  // "Automático" também vale para o PDF; o tema salvo do PDF não muda.
  const pdfTheme = (selected: PdfReaderTheme) => (settings.resolveTheme ? settings.resolveTheme(selected) : selected) as PdfReaderTheme;
  const activePalette = isPdf && pdfReaderSettings
    ? pdfReaderThemes[pdfTheme(pdfReaderSettings.theme)]
    : settings.palette;
  const documentBrightnessFactor = Platform.OS === "web" ? Math.max(0.35, Math.min(1, settings.brightness / 100)) : 1;
  const activeReaderSettings = isReflowPdf && pdfReaderSettings
    ? {
        fontSize: pdfReaderSettings.fontSize,
        fontFamily: fontFamilies[pdfReaderSettings.font],
        marginSize: pdfReaderSettings.margin,
        lineHeight: pdfReaderSettings.lineHeight,
        paragraphSpacing: pdfReaderSettings.paragraphSpacing,
        maxWidth: pdfReaderSettings.maxWidth,
        alignment: pdfReaderSettings.alignment,
        allowTextSelection: true,
        palette: activePalette,
        theme: pdfTheme(pdfReaderSettings.theme),
      }
    : {
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        marginSize: settings.marginSize,
        lineHeight: settings.lineHeight,
        paragraphSpacing: settings.paragraphSpacing,
        maxWidth: settings.maxWidth,
        alignment: settings.alignment ?? "left",
        allowTextSelection: false,
        palette: activePalette,
        theme: settings.theme,
      };

  const pageNumber = isPdf && !isReflowPdf
    ? pdfPage
    : isEpub || isReflowPdf
    ? epubPage
    : estimatePageNumber(progress * totalCharacters, totalCharacters, totalPages);

  // Tempo restante no capítulo (EPUB e Leitura Livre, que têm capítulos medidos). Só exibição; não toca posição nem documento.
  const timeLeftLabel = useChapterTimeLeft({ enabled: bookStatus === "ready" && (isEpub || isReflowPdf) && !studySelecting, page: epubPage, totalPages: epubTotalPages, chapterIndex: epubChapterIndex, chapterLocations });
  // Sessão de leitura medida e "Ler em foco por X min" (Fase 2). Só mede; não toca posição, documento nem progresso.
  const readingSession = useReadingSession({ bookId, format: isReflowPdf ? "reflow" : isPdf ? "pdf" : "epub", ready: bookStatus === "ready", page: pageNumber });
  const focusLabel = readingSession.focusLeft !== null ? `foco: ${readingSession.focusLeft} min` : null;
  // Marcos de leitura locais (FASE 5b): por conta e por livro, só neste aparelho; o rótulo some com as contagens.
  const [milestonePlan, setMilestonePlan] = useState<MilestonePlan | null>(null);
  const [milestonesVisible, setMilestonesVisible] = useState(false);
  const [focusCardVisible, setFocusCardVisible] = useState(false);
  useEffect(() => {
    let active = true; setMilestonePlan(null);
    const userId = libraryAccountScope.userId;
    if (userId) void appDependencies.readingMilestones.get(userId, bookId).then(plan => { if (active) setMilestonePlan(plan); }).catch(() => undefined);
    return () => { active = false; };
  }, [bookId]);
  const saveMilestones = useCallback((plan: MilestonePlan | null) => {
    const userId = libraryAccountScope.userId;
    setMilestonesVisible(false);
    if (!userId) { setReflowFeedback("Entre na sua conta para salvar marcos."); return; }
    void appDependencies.readingMilestones.set(userId, bookId, plan).then(() => setMilestonePlan(plan))
      .catch(() => setReflowFeedback("Não foi possível salvar os marcos deste livro."));
  }, [bookId]);
  const milestoneText = milestonePlan ? milestoneLabel(milestonePlan, progress) : null;
  // Leitura em voz alta (onda C1): texto do capítulo atual a partir da posição proporcional da página; não navega nem grava posição.
  const readAloud = useReadAloud();
  const listen = useCallback(() => {
    const source = isEpub ? chapters : isReflowPdf ? pdfReflowChapters : [];
    const chapter = source[epubChapterIndex];
    if (!chapter) return;
    const sorted = [...chapterLocations].sort((a, b) => a.pageNumber - b.pageNumber);
    const here = sorted.findIndex(item => item.chapterIndex === epubChapterIndex);
    const chapterStart = here >= 0 ? sorted[here].pageNumber : epubPage;
    const nextStart = here >= 0 ? sorted.slice(here + 1).find(item => item.pageNumber > chapterStart)?.pageNumber ?? epubTotalPages + 1 : epubPage + 1;
    const text = htmlToSpeechText(chapter.html);
    readAloud.start(text.slice(speechStartOffset(text, epubPage, chapterStart, nextStart)), chapterLanguage(chapter.html));
    setReaderPanel(null);
  }, [chapterLocations, chapters, epubChapterIndex, epubPage, epubTotalPages, isEpub, isReflowPdf, pdfReflowChapters, readAloud]);
  const displayedTotalPages = isPdf && !isReflowPdf
    ? pdfTotalPages
    : isEpub || isReflowPdf
    ? epubTotalPages
    : totalPages;

  const handlePdfTotalPages = useCallback(
    (count: number) => {
      if (!Number.isFinite(count) || count <= 0) return;
      const restoredPage = Math.max(
        1,
        Math.min(
          count,
          Math.round(initialPdfProgress.current * Math.max(0, count - 1)) + 1
        )
      );
      setPdfTotalPages(count);
      setPdfPage(restoredPage);
      setProgress(count > 1 ? (restoredPage - 1) / (count - 1) : 0);
    },
    [setProgress]
  );

  useNativeReaderBrightness({ bookId, ready: bookStatus === "ready", brightness: settings.brightness, useSystemBrightness: settings.useSystemBrightness });

  const handleProgress = (nextProgress: number, origin: ReaderNavigationOrigin = "SLIDER_COMMIT") => {
    if (studySelecting) return;
    if (isEpub || isReflowPdf) {
      if (epubTotalPages < 1) return;
      const target = Math.max(1, Math.min(epubTotalPages, Math.round(nextProgress * (epubTotalPages - 1)) + 1));
      const id = ++epubNavigationRequestId.current;
      requestedNavigationId.current = id;
      setRequestedPage(target);
      setEpubNavigationRequest({ id, pageNumber: target, origin });
      readerNavigationDiagnostic(origin, { operationId: id, requestedPage: target,
        confirmedPage: epubPage, currentPage: epubPage, targetPage: target, totalPages: epubTotalPages,
        sliderDragging: false, controlsVisible });
      return;
    }
    setProgress(nextProgress);

    const pdfPageNumber =
      isPdf && !isReflowPdf && pdfTotalPages > 0
        ? Math.max(
            1,
            Math.min(
              pdfTotalPages,
              Math.round(nextProgress * Math.max(0, pdfTotalPages - 1)) + 1
            )
          )
        : null;

    if (pdfPageNumber !== null) setPdfPage(pdfPageNumber);

    const currentChapterId =
      (isReflowPdf ? pdfReflowChapters : chapters)[epubChapterIndex]?.id ??
      (isReflowPdf ? pdfReflowChapters : chapters)[0]?.id ??
      null;

    if (isPdf) {
      const progressKey = isReflowPdf ? "reflowProgress" : "originalProgress";
      setPdfReaderSettings(current => current ? { ...current, [progressKey]: nextProgress } : current);
    }
    void appDependencies.updateReadingProgress.execute({
        bookId,
        currentChapterId,
        cfiPosition: persistedLocation.current,
        percentage: nextProgress,
        pageNumber:
          pdfPageNumber ??
          (isEpub || isReflowPdf
            ? 1
            : estimatePageNumber(
                nextProgress * totalCharacters,
                totalCharacters,
                totalPages
              )),
      }).catch(() => console.log("[ReaderProgress] Failed to persist acknowledged position"));
  };

  const handleEpubPageInfo = useCallback((info: EpubPageInfo) => {
    const { readingAnchor: privateAnchor, ...diagnostic } = info;
    readerNavigationDiagnostic("VIEWER_CONFIRMATION", { ...diagnostic, confirmedPage: info.pageNumber, controlsVisible: useReaderStore.getState().controlsVisible });
    if (info.operationId !== undefined && info.operationId < acceptedNavigationId.current) return;
    if (info.operationId !== undefined) acceptedNavigationId.current = info.operationId;
    if (info.operationId !== undefined && info.operationId >= requestedNavigationId.current) {
      setRequestedPage(null);
    }
    console.log(`[FORENSIC:handleEpubPageInfo] received page=${info.pageNumber} total=${info.totalPages} layoutReady=${Boolean(info.layoutReady)} chapter=${info.chapterIndex} | closure:epubTotalPages=${epubTotalPages} initialEpubProgress=${initialEpubProgress.current} reflowRestoreState=${reflowRestoreState}`);

    if ((isEpub || isReflowPdf) && reflowRestoreState !== "inactive") {
      if (!info.layoutReady) {
        console.log(`[FORENSIC:reflowRestore] ignored provisional page info page=${info.pageNumber} total=${info.totalPages} state=${reflowRestoreState}`);
        return;
      }

      const anchorAcknowledged = restoreTextAnchor && info.origin === "RESTORE" && info.anchorRestoreStatus;
      if (restoreTextAnchor && !anchorAcknowledged) {
        // Only the dedicated restore ACK may release the saved textual intent.
        setEpubTotalPages(info.totalPages);
        const fallback = Math.max(0, Math.min(1, initialEpubProgress.current ?? 0));
        setEpubPage(Math.round(fallback * Math.max(0, info.totalPages - 1)) + 1);
        setReflowRestoreState("applying");
        return;
      }
      if (anchorAcknowledged) {
        if (info.anchorRestoreStatus === "missing" || info.anchorRestoreStatus === "ambiguous") {
          positionRestoreFailed.current = true;
          setStudyFeedback("O trecho salvo não pôde ser localizado com segurança. A posição por progresso foi recuperada; confira a leitura antes de continuar.");
          setStudyVisible(true);
        }
        initialEpubProgress.current = null;
        reflowRestoreTarget.current = null;
        setReflowRestoreState("inactive");
      } else {
      const savedProgress = Math.max(0, Math.min(1, initialEpubProgress.current ?? 0));
      const restoredPage = Math.max(
        1,
        Math.min(info.totalPages, Math.round(savedProgress * Math.max(0, info.totalPages - 1)) + 1)
      );
      const previousTarget = reflowRestoreTarget.current;
      const targetChanged = !previousTarget || previousTarget.page !== restoredPage || previousTarget.totalPages !== info.totalPages;

      if (reflowRestoreState === "pending" || targetChanged) {
        reflowRestoreTarget.current = { page: restoredPage, totalPages: info.totalPages };
        setEpubTotalPages(info.totalPages);
        setEpubPage(restoredPage);
        setEpubChapterIndex(info.chapterIndex);
        if (info.chapterLocations) setChapterLocations(info.chapterLocations);
        if (info.chapterTitle) setChapterTitle(info.chapterTitle);
        console.log(`[FORENSIC:reflowRestore] applying savedProgress=${savedProgress} page=${restoredPage} total=${info.totalPages} iframePage=${info.pageNumber}`);
        setReflowRestoreState("applying");
        if (info.pageNumber !== restoredPage) return;
      } else if (
        info.pageNumber !== reflowRestoreTarget.current?.page ||
        info.totalPages !== reflowRestoreTarget.current?.totalPages
      ) {
        console.log(`[FORENSIC:reflowRestore] awaiting iframe acknowledgement target=${reflowRestoreTarget.current?.page}/${reflowRestoreTarget.current?.totalPages} received=${info.pageNumber}/${info.totalPages}`);
        return;
      }

      initialEpubProgress.current = null;
      reflowRestoreTarget.current = null;
      setReflowRestoreState("inactive");
      console.log(`[FORENSIC:reflowRestore] completed page=${info.pageNumber} total=${info.totalPages}`);
      }
    }

    setEpubTotalPages(info.totalPages);
    const page = info.pageNumber;

    setEpubPage(page);
    setEpubChapterIndex(info.chapterIndex);
    if (info.chapterLocations) setChapterLocations(info.chapterLocations);
    if (info.chapterTitle) setChapterTitle(info.chapterTitle);

    const nextProgress =
      info.totalPages > 1 ? (page - 1) / (info.totalPages - 1) : 0;
    setProgress(nextProgress);

    const progressChapters = isReflowPdf ? pdfReflowChapters : chapters;
    const currentChapterId =
      progressChapters[info.chapterIndex]?.id ?? progressChapters[0]?.id ?? null;

    if (isPdf) {
      const progressKey = isReflowPdf ? "reflowProgress" : "originalProgress";
      setPdfReaderSettings(current => current ? { ...current, [progressKey]: nextProgress } : current);
    }
    if (positionRestoreFailed.current) {
      if (!info.operationId || ["RESTORE", "LAYOUT_RECALC", "SETTINGS_LAYOUT"].includes(info.origin ?? "")) return;
      positionRestoreFailed.current = false;
    }
    if (info.readingAnchor) {
      try { persistedLocation.current = encodeReaderLocation(isReflowPdf ? "pdf-reflow" : "epub", info.readingAnchor); } catch { return; }
    }
    // UI/layout ACKs must not produce a new durable operation for the same position.
    const position = { bookId, currentChapterId, percentage: nextProgress, pageNumber: page, cfiPosition: persistedLocation.current };
    const writeKey = JSON.stringify(position);
    if (writeKey === lastProgressWrite.current) return;
    lastProgressWrite.current = writeKey;
    void appDependencies.updateReadingProgress.execute({
        bookId,
        currentChapterId,
        cfiPosition: persistedLocation.current,
        percentage: nextProgress,
        pageNumber: page,
      }).catch(() => { if (lastProgressWrite.current === writeKey) lastProgressWrite.current = null; console.log("[ReaderProgress] Failed to persist acknowledged position"); });
  }, [
    bookId,
    chapters,
    epubTotalPages,
    isPdf,
    isReflowPdf,
    reflowRestoreState,
    restoreTextAnchor,
    pdfReflowChapters,
    epubPage,
    setProgress,
  ]);

  const changePage = (nextPage: number, origin?: ReaderNavigationOrigin) => {
    if (studySelecting) return;
    const pageCount = isPdf && !isReflowPdf
      ? pdfTotalPages
      : isEpub || isReflowPdf
      ? epubTotalPages
      : totalPages;
    if (pageCount < 1) return;
    const page = Math.max(1, Math.min(pageCount, nextPage));
    if ((isEpub || isReflowPdf) && page !== epubPage) {
      const id = ++epubNavigationRequestId.current;
      requestedNavigationId.current = id;
      setRequestedPage(page);
      setEpubNavigationRequest({
        id,
        direction: page > epubPage ? 1 : -1,
        origin: origin ?? (page > epubPage ? "NEXT_PAGE" : "PREVIOUS_PAGE"),
      });
      return;
    }
    handleProgress(pageCount > 1 ? (page - 1) / (pageCount - 1) : 0);
  };

  const handleBookSearch = useCallback(() => {
    const term = bookSearchText.trim();
    if (!term) return;
    setBookSearchResult(null);
    setBookSearchTerm(term);
  }, [bookSearchText]);

  const handleBookSearchResult = useCallback((found: boolean) => {
    setBookSearchResult(found);
  }, []);

  const navigateToReaderChapter = (chapterIndex: number) => {
    const location = chapterLocations.find((item) => item.chapterIndex === chapterIndex);
    if (!location || epubTotalPages < 1) return;
    const targetPage = Math.min(epubTotalPages, location.pageNumber);
    handleProgress(epubTotalPages > 1 ? (targetPage - 1) / (epubTotalPages - 1) : 0, "CONTENTS");
    setReaderPanel(null);
  };

  if (bookStatus === "loading") {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: settings.palette.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <ActivityIndicator size="large" color={settings.palette.accent} />
        <Text style={{ color: settings.palette.secondaryText, marginTop: 14 }}>
          Abrindo livro...
        </Text>
      </View>
    );
  }

  if (bookStatus === "error") {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: settings.palette.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <Text style={{ color: settings.palette.text, fontSize: 16, fontWeight: "600" }}>
          {bookError ?? "Não foi possível abrir este livro."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/library")}
          style={styles.backButton}
        >
          <Text style={{ color: settings.palette.accent, fontWeight: "600" }}>
            Voltar à biblioteca
          </Text>
        </Pressable>
      </View>
    );
  }

  const readerDocument = (
    <View style={[styles.documentSurface, documentSafeInsets(Platform.OS, insets), { opacity: Platform.OS === "web" ? documentBrightnessFactor : 1 }]}>
      {!(isReflowPdf && !pdfReflowDocument) ? <DocumentReaderAdapter
        mimeType={bookMimeType}
        filePath={bookFilePath}
        chapters={chapters}
        pdfPage={pdfPage}
        pdfPageMode={pdfReaderSettings?.layout ?? pdfPageMode}
        pdfFitMode={pdfReaderSettings?.fitMode ?? "page"}
        pdfZoom={pdfReaderSettings?.zoom ?? 1}
        pdfRotation={pdfReaderSettings?.rotation ?? 0}
        pdfReadingMode={pdfReadingMode}
        pdfReflowChapters={pdfReflowChapters}
        searchTerm={isEpub || isReflowPdf ? bookSearchTerm : ""}
        onSearchResult={handleBookSearchResult}
        epubPage={epubPage}
        initialRestorePending={(isEpub || isReflowPdf) && reflowRestoreState !== "inactive"}
        restoreTargetReady={(isEpub || isReflowPdf) && reflowRestoreState === "applying"}
        restoreTextAnchor={restoreTextAnchor}
        epubNavigationRequest={epubNavigationRequest}
        settings={activeReaderSettings}
        onPdfTotalPages={handlePdfTotalPages}
        onEpubPageInfo={handleEpubPageInfo}
        onProgressChange={handleProgress}
        onPreviousPage={() => changePage(pageNumber - 1, "TOUCH_ZONE")}
        onNextPage={() => changePage(pageNumber + 1, "TOUCH_ZONE")}
        onToggleControls={handleToggleControls}
        studyRequest={studyRequest}
        onStudyResult={handleStudyResult}
        studySelecting={studySelecting}
        panelOpen={readerPanel !== null || studyVisible}
        studyHighlights={isEpub ? studyHighlights : undefined}
      /> : null}
    </View>
  );
  const readerControlProps = {
    hideReadingCounts: settings.hideReadingCounts,
    timeLeftLabel: [timeLeftLabel, focusLabel, milestoneText].filter(Boolean).join(" · ") || null,
    requestedPage,
    operationId: requestedNavigationId.current,
    diagnosticContext: { mode: isPdf ? (isReflowPdf ? "reflow" : "original") : "epub", controlsVisible, reflowPreparing, feedback: Boolean(reflowFeedback) } as ReaderUiContext,
    visible: controlsVisible && !studySelecting,
    title: bookTitle,
    chapterTitle,
    progress,
    pageNumber,
    totalPages: displayedTotalPages,
    accent: activePalette.accent,
    text: activePalette.text,
    secondaryText: activePalette.secondaryText,
    background: activePalette.background,
    onBack: () => router.push("/(tabs)/library"),
    onSettings: () => setReaderPanel("appearance"),
    onHeaderHeight: setHeaderHeight,
    onSearch: isEpub || isReflowPdf ? () => setReaderPanel("search") : undefined,
    onContents: readerChapterItems.length > 0 ? () => setReaderPanel("contents") : undefined,
    onStudy: !isReflowPdf && (isEpub || isPdf) ? () => { studySelectionIntent.current = false; setStudySelectionCaptured(false); setStudyVisible(true); setStudyAnchor(null); setStudyFeedback(null); } : undefined,
    onProgressChange: handleProgress,
    onPagePrevious: () => changePage(pageNumber - 1),
    onPageNext: () => changePage(pageNumber + 1),
  };
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: activePalette.background },
      ]}
    >
      <StatusBar
        barStyle={["dark", "black"].includes(pdfReaderSettings ? pdfTheme(pdfReaderSettings.theme) : settings.theme) ? "light-content" : "dark-content"}
      />

      <View style={styles.reader}>
        {isReflowPdf ? (
          <ReaderControls
            {...readerControlProps}
            layoutMode="overlay"
          >
            {readerDocument}
          </ReaderControls>
        ) : (
          <>
            {readerDocument}
            <ReaderControls {...readerControlProps} layoutMode="overlay" />
          </>
        )}

        <MotionCuesOverlay color={activePalette.text} />
        {studySelecting ? <View style={{ position: "absolute", bottom: Math.max(insets.bottom, 12) + 64, left: 16, right: 16, zIndex: 30, backgroundColor: activePalette.panel, padding: 12, borderRadius: 8 }}><Text style={{ color: activePalette.text }}>{Platform.OS === "web" ? "Arraste sobre o texto. Solte para escolher a cor." : "Toque e segure uma palavra. Ajuste a seleção e solte para escolher a cor."}</Text>{studyFeedback ? <Text accessibilityRole="alert" style={{ color: activePalette.text }}>{studyFeedback}</Text> : null}<Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => { studySelectionIntent.current = false; setStudySelectionCaptured(false); setStudySelecting(false); setStudyVisible(true); setStudyRequest({ id: ++studySequence.current, type: "studySelection", enabled: false }); }}><Text style={{ color: activePalette.accent, paddingVertical: 10 }}>Cancelar seleção</Text></Pressable></View> : null}
        {studyVisible && currentBook ? <StudyBookmarksPanel book={currentBook} capture={studyAnchor} chapterTitle={chapterTitle} loading={studyLoading} feedback={studyStorageError ?? studyFeedback ?? studyRenderFeedback}
          highlights={isEpub ? studyHighlights : undefined} onHighlightsSaved={reloadHighlights}
          selectionCaptured={studySelectionCaptured} onCaptureConsumed={() => { setStudySelectionCaptured(false); setStudyAnchor(null); }}
          onSelectText={isEpub ? () => { studySelectionIntent.current = true; setStudySelectionCaptured(false); setStudyVisible(false); setStudySelecting(true); setStudyFeedback(null); setStudyAnchor(null); setStudyRequest({ id: ++studySequence.current, type: "studySelection", enabled: true }); } : undefined}
          onCapture={() => {
            studySelectionIntent.current = false; setStudySelectionCaptured(false); setStudyAnchor(null); setStudyFeedback(null);
            if (isPdf && !isReflowPdf) { setStudyAnchor({ version: 1, kind: "pdf-page", sourcePage: pdfPage }); return; }
            setStudyLoading(true); setStudyRequest({ id: ++studySequence.current, type: "studyCapture" });
          }}
          onNavigate={anchor => {
            if (anchor.kind === "pdf-page") {
              if (!isPdf || isReflowPdf || anchor.sourcePage > pdfTotalPages) { setStudyFeedback("Esta página fonte não está disponível neste modo ou arquivo."); return; }
              handleProgress(pdfTotalPages > 1 ? (anchor.sourcePage - 1) / (pdfTotalPages - 1) : 0); setStudyVisible(false); return;
            }
            setStudyLoading(true); setStudyRequest({ id: ++studySequence.current, type: "studyNavigate", anchor });
          }}
          onClose={() => setStudyVisible(false)} /> : null}

        {isPdf && reflowPreparing && bookFilePath ? (
          <PdfReflowProcessor
            uri={bookFilePath}
            onProgress={handleReflowProgress}
            onComplete={handleReflowComplete}
            onError={handleReflowError}
            onCancel={handleCancelReflow}
          />
        ) : null}

        {readAloud.speaking || readAloud.error ? (
          <ReaderFeedbackBanner
            message={readAloud.error ?? "Lendo em voz alta…"}
            transient={false}
            palette={activePalette}
            top={readerFeedbackTop(insets.top, controlsVisible && !studySelecting, headerHeight)}
            actionLabel={readAloud.error ? "Fechar" : "Parar"}
            actionAccessibilityLabel={readAloud.error ? "Fechar aviso" : "Parar leitura em voz alta"}
            onDismiss={readAloud.stop}
          />
        ) : readingSession.summary ? (
          <ReaderFeedbackBanner
            message={readingSession.summary}
            transient={false}
            palette={activePalette}
            top={readerFeedbackTop(insets.top, controlsVisible && !studySelecting, headerHeight)}
            actionLabel={readingSession.lastFocus ? "Ver cartão" : "Fechar"}
            actionAccessibilityLabel={readingSession.lastFocus ? "Ver cartão de foco" : "Fechar resumo do foco"}
            onDismiss={() => { if (readingSession.lastFocus) setFocusCardVisible(true); readingSession.dismissSummary(); }}
          />
        ) : reflowFeedback ? (
          <ReaderFeedbackBanner
            message={reflowFeedback}
            transient={transientFeedback}
            palette={activePalette}
            top={readerFeedbackTop(insets.top, controlsVisible && !studySelecting, headerHeight)}
            onDismiss={() => setReflowFeedback(null)}
            onLayout={event => readerUiDiagnostic("LAYOUT", "feedback", readerControlProps.diagnosticContext, event.nativeEvent.layout, { pointerEvents: "box-none", zIndex: 40 })}
          />
        ) : null}

        {focusCardVisible && readingSession.lastFocus ? <FocusCardModal
          record={readingSession.lastFocus}
          title={bookTitle}
          hideCounts={settings.hideReadingCounts}
          palette={activePalette}
          onShare={text => { void Share.share({ message: text }).catch(() => undefined); }}
          onClose={() => { setFocusCardVisible(false); readingSession.clearLastFocus(); }}
        /> : null}

        {milestonesVisible ? <ReadingMilestonesModal
          visible
          title={bookTitle}
          plan={milestonePlan}
          progress={progress}
          hideCounts={settings.hideReadingCounts}
          palette={activePalette}
          onSave={saveMilestones}
          onShare={plan => { void Share.share({ message: milestoneScheduleText(plan, bookTitle) }).catch(() => undefined); }}
          onClose={() => setMilestonesVisible(false)}
        /> : null}

        {/* Aa Typography & Theme Settings Modal */}
        <ReaderSettingsPanel
          visible={readerPanel !== null}
          panelMode={readerPanel ?? "appearance"}
          onClose={() => setReaderPanel(null)}
          onReadInFocus={(minutes?: number | null) => { setReaderPanel(null); setControlsVisible(false); readingSession.startFocus(minutes ?? null); }}
          focusMinutesLeft={readingSession.focusLeft}
          onEndFocus={readingSession.endFocus}
          focusSummaryEnabled={readingSession.summaryEnabled}
          onFocusSummaryChange={readingSession.setFocusSummaryEnabled}
          onOpenDoNotDisturb={Platform.OS === "android" ? () => { void openSystemDoNotDisturb(); } : undefined}
          onOpenMilestones={() => { setReaderPanel(null); setMilestonesVisible(true); }}
          onListen={isEpub || isReflowPdf ? listen : undefined}
          onStopListening={readAloud.stop}
          listening={readAloud.speaking}
          pdfMode={isPdf ? pdfReadingMode : undefined}
          pdfSettings={isPdf ? pdfReaderSettings : null}
          onPdfModeChange={isPdf ? handlePdfModeChange : undefined}
          onPdfSettingsChange={isPdf ? handlePdfSettingsChange : undefined}
          pdfSettingsSaveError={isPdf && pdfSettingsSaveFailedBookId === bookId ? PDF_SETTINGS_SAVE_ERROR : null}
          onToggleFullscreen={isPdf && pdfReadingMode === "original" ? handleToggleFullscreen : undefined}
          pageNumber={pageNumber}
          totalPages={displayedTotalPages}
          onGoToPage={isPdf && !isReflowPdf ? changePage : undefined}
          chapterItems={readerChapterItems}
          chapterIndex={epubChapterIndex}
          onSelectChapter={readerChapterItems.length > 0 ? navigateToReaderChapter : undefined}
          searchText={isEpub || isReflowPdf ? bookSearchText : undefined}
          onSearchTextChange={isEpub || isReflowPdf ? setBookSearchText : undefined}
          onSearch={isEpub || isReflowPdf ? handleBookSearch : undefined}
          searchResult={isEpub || isReflowPdf ? bookSearchResult : null}
        />
      </View>
      <PdfModeChooser
        visible={pdfModeChooserVisible && isPdf}
        onChoose={handlePdfModeChange}
        onCancel={() => handlePdfModeChange("original")}
      />
    </View>
  );
}

async function getPdfSourceSignature(book: LibraryBook, signal: AbortSignal): Promise<string> {
  return book.fileHash ?? appDependencies.privateBookFiles.localFingerprint(book.id, signal);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  reader: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
  },
  documentSurface: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
});
