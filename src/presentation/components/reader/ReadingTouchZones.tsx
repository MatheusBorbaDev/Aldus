import { useEffect, useRef } from "react";
import { GestureResponderEvent, LayoutRectangle, Platform, Pressable, StyleSheet, View } from "react-native";
import { epubDiagnosticConsole as console } from "@/src/utils/epubOpenMetrics";

interface Props {
  onPreviousPage: () => void;
  onNextPage: () => void;
  onToggleControls: () => void;
  /** Pressionar e segurar (Fase B): ponto em coordenadas da página do livro (mesmo contêiner da WebView). */
  onLongPressText?: (x: number, y: number) => void;
  /** Arrastar depois do toque longo (23/11/2026): ponto do dedo nas mesmas coordenadas; `final` ao soltar, `moved` se houve arraste. */
  onDragText?: (x: number, y: number, final: boolean, moved: boolean) => void;
}

interface TextDrag { offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean; sentAt: number }

export function ReadingTouchZones({ onPreviousPage, onNextPage, onToggleControls, onLongPressText, onDragText }: Props) {
  const layout = useRef<LayoutRectangle | null>(null);
  const drag = useRef<TextDrag | null>(null);
  // Cada zona começa numa fração da largura (30% · 40% · 30%); o ponto vai para o contêiner somando a posição da faixa.
  const longPress = (zoneStart: number) => onLongPressText ? (event: GestureResponderEvent) => {
    const area = layout.current; if (!area) return;
    const { locationX, locationY, pageX, pageY } = event.nativeEvent;
    const x = area.x + area.width * zoneStart + locationX, y = area.y + locationY;
    // O arraste usa a posição na tela (pageX/pageY) com o mesmo deslocamento: o dedo pode sair da zona onde começou.
    drag.current = { offsetX: x - pageX, offsetY: y - pageY, startX: pageX, startY: pageY, moved: false, sentAt: 0 };
    onLongPressText(x, y);
  } : undefined;
  const dragMove = (event: GestureResponderEvent) => {
    const current = drag.current; if (!current || !onDragText) return;
    const { pageX, pageY } = event.nativeEvent;
    if (!current.moved && Math.abs(pageX - current.startX) + Math.abs(pageY - current.startY) <= 10) return;
    current.moved = true;
    const now = Date.now(); if (now - current.sentAt < 50) return;
    current.sentAt = now;
    onDragText(pageX + current.offsetX, pageY + current.offsetY, false, true);
  };
  const dragEnd = (event: GestureResponderEvent) => {
    const current = drag.current; drag.current = null;
    if (!current || !onDragText) return;
    const { pageX, pageY } = event.nativeEvent;
    // Sem arraste o toque longo já selecionou a palavra; o fim só encerra o gesto.
    onDragText(pageX + current.offsetX, pageY + current.offsetY, true, current.moved);
  };
  const dragProps = onDragText ? { onTouchMove: dragMove, onTouchEnd: dragEnd, onTouchCancel: dragEnd } : {};
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.altKey || event.ctrlKey || event.metaKey ||
        target?.closest("input, textarea, select, button, a, [role='button'], [contenteditable='true']")
      ) {
        return;
      }

      // PC (23/11/2026): Espaço/Page Down avançam e Shift+Espaço/Page Up voltam, como nos leitores de mesa.
      const back = event.key === "PageUp" || (event.key === " " && event.shiftKey);
      const forward = event.key === "PageDown" || (event.key === " " && !event.shiftKey);
      if (event.key === "ArrowLeft" || back) {
        event.preventDefault();
        onPreviousPage();
      } else if (event.key === "ArrowRight" || forward) {
        event.preventDefault();
        onNextPage();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onToggleControls();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNextPage, onPreviousPage, onToggleControls]);

  return (
    <View style={styles.overlay} pointerEvents="box-none" onLayout={event => { layout.current = event.nativeEvent.layout; }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Página anterior"
        style={styles.leftZone}
        onPress={onPreviousPage}
        onLongPress={longPress(0)}
        {...dragProps}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alternar menus e controles de leitura"
        style={styles.centerZone}
        onLongPress={longPress(0.3)}
        {...dragProps}
        onPress={() => {
          console.log(`[FORENSIC:center-click] t=${performance.timeOrigin + performance.now()} center Pressable onPress`);
          onToggleControls();
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próxima página"
        style={styles.rightZone}
        onPress={onNextPage}
        onLongPress={longPress(0.7)}
        {...dragProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: "20%",
    bottom: "20%",
    left: 0,
    right: 0,
    flexDirection: "row",
    zIndex: 5,
  },
  leftZone: {
    width: "30%",
    height: "100%",
  },
  centerZone: {
    width: "40%",
    height: "100%",
  },
  rightZone: {
    width: "30%",
    height: "100%",
  },
});
