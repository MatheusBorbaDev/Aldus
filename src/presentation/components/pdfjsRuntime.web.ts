import type * as PdfJs from "pdfjs-dist";

export type PdfJsModule = typeof PdfJs;

let loading: Promise<PdfJsModule> | null = null;
let loaded: PdfJsModule | null = null;

/**
 * pdf.js sob demanda (onda D1). Antes ~536 KiB dele iam no bundle principal (imports estáticos), carregados por quem nunca abre um PDF.
 * Agora só baixa quando um PDF é aberto, gera capa ou é convertido. Uma falha de carga não fica em cache (a próxima tentativa recarrega).
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  loading ??= import("pdfjs-dist").then(module => { loaded = module; return module; }).catch(error => { loading = null; throw error; });
  return loading;
}

/** Módulo já carregado (para funções chamadas só depois de `loadPdfJs`, como a leitura de imagens no Reflow). */
export function loadedPdfJs(): PdfJsModule {
  if (!loaded) throw new Error("pdf.js ainda não foi carregado.");
  return loaded;
}
