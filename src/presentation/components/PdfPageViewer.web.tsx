import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import { loadPdfJs } from "./pdfjsRuntime.web";
import { PdfPageViewerProps } from "@/src/presentation/components/PdfPageViewerProps";
import { PDF_SCROLL_SOURCE } from "@/src/domain/reader/pdfScroll";

type Scroller = { goTo: (page: number) => void; current: () => number; destroy: () => void };
let scrollerFactory: ((options: Record<string, unknown>) => Promise<Scroller>) | null = null;
// Mesma fonte literal da WebView do Android; constante do próprio app.
const loadScroller = () => scrollerFactory ??= new Function(`${PDF_SCROLL_SOURCE}; return createPdfScroller;`)() as (options: Record<string, unknown>) => Promise<Scroller>;

type PdfPage = Awaited<ReturnType<PDFDocumentProxy["getPage"]>>;

export function PdfPageViewer({ uri, pageNumber, pageMode, fitMode, zoom, rotation, onTotalPages, flow = "paged", onScrollPage, onTap }: PdfPageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<Scroller | null>(null);
  const scrollCallbacks = useRef({ onScrollPage, onTap });
  scrollCallbacks.current = { onScrollPage, onTap };
  const scrolling = flow === "scroll";
  const totalPagesCallback = useRef(onTotalPages);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    totalPagesCallback.current = onTotalPages;
  }, [onTotalPages]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setDocument(null);

    // pdf.js sob demanda (onda D1); mesma configuração de worker e documento de antes.
    let task: PDFDocumentLoadingTask | null = null;
    void loadPdfJs()
      .then(({ getDocument, GlobalWorkerOptions }) => {
        if (!active) return null;
        try {
          GlobalWorkerOptions.workerPort = new Worker(new URL("./pdfjs.worker.ts", import.meta.url));
        } catch {
          /* Fall back to PDF.js worker configuration. */
        }
        task = getDocument({
          url: uri,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
        });
        return task.promise;
      })
      .then((pdf) => {
        if (!active || !pdf) return;
        setDocument(pdf);
        totalPagesCallback.current(pdf.numPages * (pageMode === "double" ? 2 : 1));
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (task) void task.destroy();
    };
  }, [uri, pageMode]);

  // Rolagem contínua: páginas empilhadas na largura, desenhadas perto da área visível (controlador literal compartilhado).
  useEffect(() => {
    const container = scrollRef.current;
    if (!scrolling || !document || !container) return;
    let active = true;
    setLoading(true);
    void loadScroller()({ container, pdf: document, page: pageNumber, zoom, rotation,
      onPage: (page: number, offset: number) => scrollCallbacks.current.onScrollPage?.(page, offset),
      onTap: () => scrollCallbacks.current.onTap?.(),
      onError: () => { if (active) setFailed(true); } })
      .then(created => { if (!active) { created.destroy(); return; } scroller.current = created; setLoading(false); })
      .catch(() => { if (active) { setFailed(true); setLoading(false); } });
    return () => { active = false; scroller.current?.destroy(); scroller.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageNumber só posiciona; mudanças vão pelo goTo abaixo.
  }, [scrolling, document, zoom, rotation]);

  useEffect(() => {
    if (scrolling && scroller.current && scroller.current.current() !== pageNumber) scroller.current.goTo(pageNumber);
  }, [scrolling, pageNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (scrolling || !document || !canvas || !viewport.width || !viewport.height) return;

    let active = true;
    let renderTask: ReturnType<PdfPage["render"]> | null = null;
    setLoading(true);

    void document
      .getPage(pageMode === "double" ? Math.ceil(pageNumber / 2) : pageNumber)
      .then((page) => {
        if (!active) return;
        const isDouble = pageMode === "double";
        const isRightHalf = isDouble && pageNumber % 2 === 0;
        const pageRotation = (page.rotate + rotation) % 360;
        const baseViewport = page.getViewport({ scale: 1, rotation: pageRotation });
        const contentWidth = isDouble ? baseViewport.width / 2 : baseViewport.width;
        const widthScale = viewport.width / contentWidth;
        const heightScale = viewport.height / baseViewport.height;
        const fitScale = fitMode === "width" ? widthScale : Math.min(widthScale, heightScale);
        const deviceScale = Math.min(window.devicePixelRatio || 1, 2.5);
        const pageViewport = page.getViewport({
          scale: fitScale * zoom * deviceScale,
          rotation: pageRotation,
        });

        // High-resolution backing store
        canvas.width = Math.ceil(pageViewport.width / (isDouble ? 2 : 1));
        canvas.height = Math.ceil(pageViewport.height);

        // Force full viewport fit with dynamic flex and object-fit: contain
        canvas.style.width = `${canvas.width / deviceScale}px`;
        canvas.style.height = `${canvas.height / deviceScale}px`;
        canvas.style.maxWidth = "none";
        canvas.style.maxHeight = "none";
        canvas.style.objectFit = "contain";
        canvas.style.flex = "none";
        canvas.style.display = "block";

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas indisponível.");

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport: pageViewport,
          transform: isRightHalf ? [1, 0, 0, 1, -canvas.width, 0] : undefined,
        });
        return renderTask.promise;
      })
      .then(() => {
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [scrolling, document, pageNumber, pageMode, fitMode, zoom, rotation, viewport]);

  return (
    <View
      style={styles.stage}
      onLayout={({ nativeEvent }) =>
        setViewport({
          width: nativeEvent.layout.width,
          height: nativeEvent.layout.height,
        })
      }
    >
      {scrolling ? <div ref={scrollRef} data-pdf-flow="scroll" style={scrollStyle} /> : <canvas ref={canvasRef} style={canvasStyle} />}
      {loading && !failed ? (
        <View style={styles.status}>
          <ActivityIndicator size="large" color="#315D56" />
          <Text style={styles.message}>Carregando página...</Text>
        </View>
      ) : null}
      {failed ? (
        <View style={styles.status}>
          <Text style={styles.message}>Não foi possível abrir este PDF.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "scroll",
    position: "relative",
  },
  status: {
    position: "absolute",
    alignItems: "center",
    gap: 12,
  },
  message: {
    color: "#555",
    fontSize: 13,
    fontWeight: "500",
  },
});

const canvasStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  maxWidth: "none",
  maxHeight: "none",
  objectFit: "contain",
  flex: 1,
  backgroundColor: "#ffffff",
  boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.18)",
  borderRadius: "2px",
};
const scrollStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", overflowX: "hidden" };
