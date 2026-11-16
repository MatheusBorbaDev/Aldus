import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export type ShareQuoteCardResult = "shared" | "downloaded" | "unavailable";

/**
 * Envia a imagem do card pela folha de compartilhamento do Android (Instagram Stories, X, WhatsApp...). Grava um JPEG
 * temporário no cache do app; nada sai do aparelho além da imagem que a pessoa escolher enviar. Só Android neste fluxo.
 */
export async function shareQuoteCard(dataUrl: string, fileName: string): Promise<ShareQuoteCardResult> {
  const prefix = "data:image/jpeg;base64,";
  if (!dataUrl.startsWith(prefix) || !FileSystem.cacheDirectory) throw new Error("Não foi possível preparar a imagem do card.");
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  const target = `${FileSystem.cacheDirectory}${fileName.replace(/[^\w.-]+/g, "-")}`;
  await FileSystem.writeAsStringAsync(target, dataUrl.slice(prefix.length), { encoding: "base64" } as never);
  await Sharing.shareAsync(target, { mimeType: "image/jpeg", dialogTitle: "Compartilhar trecho", UTI: "public.jpeg" });
  return "shared";
}
