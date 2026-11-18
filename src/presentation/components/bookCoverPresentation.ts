import { aldusCoverDesign } from "@/src/domain/catalog/defaultCover";

/**
 * Presentation only: never modifies book metadata or queries a cover service. Since 18/11/2026 the fallback is the approved
 * Aldus default cover (same title + author, same cover); `identity` stays in the signature for existing callers.
 */
export function editorialCover(_identity: string, title: string, author?: string) {
  const design = aldusCoverDesign(title, author);
  return { ...design, paper: design.palette.background, ink: design.palette.text, detail: design.palette.accent };
}
