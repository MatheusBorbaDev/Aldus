import { PdfReflowPageData } from "@/src/domain/types/pdfReader";
import { buildPdfReflowDocumentAsync } from "@/src/data/local/PdfReflowDocumentBuilder";
import { isValidatedReflowDocumentAsync } from "@/src/data/local/pdfReflowQuality";

/** Pages extracted before the start of the book can be read (18/11/2026: ~1 s of extraction on the Redmi). */
export const REFLOW_PREVIEW_PAGES = 40;

export interface PdfReflowPreviewBlock { type: "heading" | "paragraph"; text: string; level?: number }
/** Text only, never cached and never a reading position: the complete document replaces it. */
export interface PdfReflowPreview { pageCount: number; blocks: PdfReflowPreviewBlock[] }

/**
 * The start of the book while the rest is prepared. Same builder and the same text check as the complete document, on copies of
 * the first pages without images; null when that text would not pass (scanned pages, too little text), so nothing unchecked is shown.
 */
export async function buildPdfReflowPreviewAsync(pages: PdfReflowPageData[], signal: AbortSignal): Promise<PdfReflowPreview | null> {
  const first = pages.slice(0, REFLOW_PREVIEW_PAGES).map(page => ({ ...page, textItems: page.textItems.slice(), images: [] }));
  if (first.length === 0) return null;
  let document;
  try {
    document = await buildPdfReflowDocumentAsync(first, first.length, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    return null; // Text the builder rejects (corrupt extraction): the preparation reports it, the preview just does not appear.
  }
  if (document.classification === "image-based" || !await isValidatedReflowDocumentAsync(document, signal)) return null;
  const blocks: PdfReflowPreviewBlock[] = [];
  for (const chapter of document.chapters) {
    for (const block of chapter.blocks) {
      const text = block.text?.trim();
      if (!text || block.type === "image") continue;
      blocks.push(block.type === "heading" ? { type: "heading", text, level: block.level } : { type: "paragraph", text });
    }
  }
  return blocks.some(block => block.type === "paragraph") ? { pageCount: first.length, blocks } : null;
}
