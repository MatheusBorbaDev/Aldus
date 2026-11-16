import { useEffect, useRef } from "react";
import { QUOTE_CARD_RENDERER, QuoteCardSpec } from "@/src/domain/reader/quoteCard";

type Renderer = (ctx: CanvasRenderingContext2D, spec: QuoteCardSpec, makeCanvas: (w: number, h: number) => HTMLCanvasElement) => unknown;
let renderer: Renderer | null = null;
// Mesma fonte literal usada na WebView do Android; constante do próprio app, nunca texto de fora.
const loadRenderer = () => renderer ??= new Function(`${QUOTE_CARD_RENDERER}; return renderQuoteCard;`)() as Renderer;

/** Gera a imagem do card no site: canvas fora da tela, JPEG em `data:`. */
export function QuoteCardCanvas({ spec, onImage, onError }: { spec: QuoteCardSpec | null; onImage: (dataUrl: string) => void; onError: (message: string) => void }) {
  const generation = useRef(0);
  useEffect(() => {
    if (!spec || typeof document === "undefined") return;
    const id = ++generation.current;
    const timer = setTimeout(() => {
      try {
        const canvas = document.createElement("canvas"); canvas.width = spec.width; canvas.height = spec.height;
        const context = canvas.getContext("2d"); if (!context) throw new Error("canvas");
        loadRenderer()(context, spec, (w, h) => { const tile = document.createElement("canvas"); tile.width = w; tile.height = h; return tile; });
        if (id === generation.current) onImage(canvas.toDataURL("image/jpeg", 0.9));
      } catch { if (id === generation.current) onError("Não foi possível desenhar o card."); }
    }, 0);
    return () => clearTimeout(timer);
  }, [spec, onImage, onError]);
  return null;
}
