export type ShareQuoteCardResult = "shared" | "downloaded" | "unavailable";

/** No site: compartilhamento do navegador quando aceita imagem; senão, baixa o JPEG. */
export async function shareQuoteCard(dataUrl: string, fileName: string): Promise<ShareQuoteCardResult> {
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw new Error("Não foi possível preparar a imagem do card.");
  const blob = await (await fetch(dataUrl)).blob();
  const file = typeof File === "function" ? new File([blob], fileName, { type: "image/jpeg" }) : null;
  const nav = typeof navigator !== "undefined" ? navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean } : null;
  if (file && nav?.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: "Trecho" } as ShareData); return "shared"; }
    catch (error) { if (error instanceof Error && error.name === "AbortError") return "shared"; }
  }
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
