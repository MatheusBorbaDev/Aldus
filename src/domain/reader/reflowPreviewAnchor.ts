import { PdfReflowDocument } from "@/src/domain/types/pdfReader";
import { TextReadingAnchor } from "@/src/domain/types/readingAnchor";

const FIRST_QUOTE = 60, QUOTE_STEP = 60, LONGEST_QUOTE = 300;

/** Text of each Leitura Livre chapter as the reader shows it (the contents list sits in the first one); used only to count matches. */
function chapterTexts(document: PdfReflowDocument): string[] {
  return document.chapters.map((chapter, index) => {
    const blocks = chapter.blocks.map(block => block.type === "image" ? "" : block.text ?? "");
    const toc = index === 0 && document.toc.length ? ["Sumário", ...document.toc.map(entry => entry.title)] : [];
    return [...toc, ...blocks].join("\n");
  });
}

/**
 * The paragraph at the top of the preview, given the top of each block and the scroll offset; null while the reader has not left the
 * opening (nothing to carry over). A heading at the top gives the paragraph after it: short titles repeat across a book.
 */
export function previewResumeText(blocks: ReadonlyArray<{ type: "heading" | "paragraph"; text: string }>, tops: ReadonlyArray<number | undefined>, scrollY: number): string | null {
  if (scrollY < 24) return null;
  let top = -1;
  for (let index = 0; index < blocks.length; index++) {
    const y = tops[index];
    if (y !== undefined && y <= scrollY + 8) top = index;
  }
  for (let index = Math.max(0, top); index < blocks.length; index++) if (blocks[index].type === "paragraph") return blocks[index].text;
  return null;
}

/**
 * Where the reader of the preview stopped, in the complete document: the opening words of the paragraph at the top of the preview,
 * lengthened until they occur exactly once in the whole book. Null when they are absent or never unique: the caller says so and the
 * book opens where it would have opened. The reader still checks the text itself and reports missing/ambiguous (no silent jump).
 */
export function previewReadingAnchor(bookId: string, document: PdfReflowDocument, paragraph: string): TextReadingAnchor | null {
  const text = paragraph.trim();
  if (!text) return null;
  const texts = chapterTexts(document);
  for (let length = Math.min(FIRST_QUOTE, text.length); ; length = Math.min(length + QUOTE_STEP, text.length)) {
    const quote = text.slice(0, length).trimEnd();
    let chapter = -1, start = -1, count = 0;
    for (let index = 0; index < texts.length && count < 2; index++) {
      for (let offset = texts[index].indexOf(quote); offset !== -1 && count < 2; offset = texts[index].indexOf(quote, offset + 1)) {
        count++;
        if (count === 1) { chapter = index; start = offset; }
      }
    }
    if (count === 0) return null;
    if (count === 1) {
      return { version: 1, kind: "epub-text", chapterId: `${bookId}-reflow-${chapter}`, start, end: start + quote.length, quote, prefix: "", suffix: "", path: [] };
    }
    if (length >= text.length || length >= LONGEST_QUOTE) return null;
  }
}
