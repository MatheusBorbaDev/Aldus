import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { loadPdfJs, PdfJsModule } from "../components/pdfjsRuntime.web";

// pdf.js sob demanda (onda D1): o worker é configurado uma vez, no primeiro uso (antes, ao importar este arquivo).
let workerReady = false;
async function pdfjsForThumbnails(): Promise<PdfJsModule> {
  const pdfjs = await loadPdfJs();
  if (!workerReady && typeof window !== "undefined") {
    workerReady = true;
    try {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("../components/pdfjs.worker.ts", import.meta.url)
      );
    } catch {
      /* Fallback */
    }
  }
  return pdfjs;
}

export class WebPdfThumbnailGenerator {
  async generate(uri: string, _bookId: string, pickedFile?: Blob): Promise<string | null> {
    let loadingTask: PDFDocumentLoadingTask | undefined;
    try {
      const { getDocument } = await pdfjsForThumbnails();
      if (pickedFile) {
        const buffer = await pickedFile.arrayBuffer();
        loadingTask = getDocument({
          data: new Uint8Array(buffer),
        });
      } else if (uri.startsWith("data:application/pdf;base64,")) {
        const base64 = uri.split(",")[1];
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        loadingTask = getDocument({
          data: bytes,
        });
      } else {
        loadingTask = getDocument({
          url: uri,
        });
      }

      const pdf = await loadingTask.promise;
      if (pdf.numPages < 1) return null;

      const page = await pdf.getPage(1);
      const unscaledViewport = page.getViewport({ scale: 1 });

      // Target thumbnail width around 300px for sharp cards in 2/3 ratio
      const targetWidth = 300;
      if (!Number.isFinite(unscaledViewport.width) || !Number.isFinite(unscaledViewport.height) || unscaledViewport.width <= 0 || unscaledViewport.height <= 0) return null;
      const scale = Math.min(targetWidth / unscaledViewport.width, 480 / unscaledViewport.height);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return null;

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      return dataUrl;
    } catch {
      return null;
    } finally {
      await loadingTask?.destroy().catch(() => undefined);
    }
  }
}

export const pdfThumbnailGenerator = new WebPdfThumbnailGenerator();
