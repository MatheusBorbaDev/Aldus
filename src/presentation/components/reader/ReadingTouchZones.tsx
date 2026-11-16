import { useEffect, useRef } from "react";
import { GestureResponderEvent, LayoutRectangle, Platform, Pressable, StyleSheet, View } from "react-native";
import { epubDiagnosticConsole as console } from "@/src/utils/epubOpenMetrics";

interface Props {
  onPreviousPage: () => void;
  onNextPage: () => void;
  onToggleControls: () => void;
  /** Pressionar e segurar (Fase B): ponto em coordenadas da página do livro (mesmo contêiner da WebView). */
  onLongPressText?: (x: number, y: number) => void;
}

export function ReadingTouchZones({ onPreviousPage, onNextPage, onToggleControls, onLongPressText }: Props) {
  const layout = useRef<LayoutRectangle | null>(null);
  // Cada zona começa numa fração da largura (30% · 40% · 30%); o ponto vai para o contêiner somando a posição da faixa.
  const longPress = (zoneStart: number) => onLongPressText ? (event: GestureResponderEvent) => {
    const area = layout.current; if (!area) return;
    onLongPressText(area.x + area.width * zoneStart + event.nativeEvent.locationX, area.y + event.nativeEvent.locationY);
  } : undefined;
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

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPreviousPage();
      } else if (event.key === "ArrowRight") {
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
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alternar menus e controles de leitura"
        style={styles.centerZone}
        onLongPress={longPress(0.3)}
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
