import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { QUOTE_CARD_RENDERER, QuoteCardSpec } from "@/src/domain/reader/quoteCard";

/**
 * Gera a imagem do card (Android): WebView invisível só para o canvas, sem rede, sem navegação e sem o documento do livro.
 * Cada `spec` novo é desenhado e devolvido como JPEG em `data:` (o arquivo é gravado só na hora de compartilhar).
 */
export function QuoteCardCanvas({ spec, onImage, onError }: { spec: QuoteCardSpec | null; onImage: (dataUrl: string) => void; onError: (message: string) => void }) {
  const webView = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const generation = useRef(0);
  const html = useMemo(() => [
    '<!doctype html><html><head><meta charset="utf-8">',
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; img-src data: blob:; style-src 'unsafe-inline'\">",
    "</head><body><script>",
    QUOTE_CARD_RENDERER,
    "window.renderCard = function (spec, id) {",
    "  function draw(cover) {",
    "    try {",
    "      var canvas = document.createElement('canvas'); canvas.width = spec.width; canvas.height = spec.height;",
    "      renderQuoteCard(canvas.getContext('2d'), spec, function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, cover);",
    "      window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, dataUrl: canvas.toDataURL('image/jpeg', 0.9) }));",
    "    } catch (e) { window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, error: String(e && e.message || e) })); }",
    "  }",
    // The cover must be decoded before drawing; without it in 3 s the card is drawn without a cover.
    "  if (!spec.cover) { draw(null); return; }",
    "  var image = new Image(), settled = false, timer = setTimeout(function () { finish(false); }, 3000);",
    "  function finish(ok) { if (settled) return; settled = true; clearTimeout(timer); draw(ok ? image : null); }",
    "  image.onload = function () { finish(true); }; image.onerror = function () { finish(false); };",
    "  image.src = spec.cover;",
    "};",
    "</script></body></html>",
  ].join("\n"), []);

  useEffect(() => {
    if (!loaded || !spec) return;
    const id = ++generation.current;
    webView.current?.injectJavaScript(`window.renderCard(${JSON.stringify(spec)}, ${id}); true;`);
  }, [loaded, spec]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { id: number; dataUrl?: string; error?: string };
      if (message.id !== generation.current) return; // resposta de um card antigo
      if (typeof message.dataUrl === "string" && message.dataUrl.startsWith("data:image/jpeg;base64,")) onImage(message.dataUrl);
      else onError("Não foi possível desenhar o card.");
    } catch { onError("Não foi possível desenhar o card."); }
  };

  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView ref={webView} source={{ html }} originWhitelist={["about:blank"]} javaScriptEnabled onLoadEnd={() => setLoaded(true)} onMessage={handleMessage}
        onShouldStartLoadWithRequest={request => request.url === "about:blank" || request.url.startsWith("data:")}
        allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} cacheEnabled={false} incognito />
    </View>
  );
}

const styles = StyleSheet.create({ hidden: { position: "absolute", width: 1, height: 1, opacity: 0, left: -10, top: -10 } });
