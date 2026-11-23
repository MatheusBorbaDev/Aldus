import { Children, PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useFormFactor } from "@/src/presentation/layout/useFormFactor";

/** Largura da coluna lateral (ex.: decks do Estudo) no PC. */
export const DESKTOP_ASIDE_WIDTH = 420;

/**
 * PC (23/11/2026): cartões lado a lado, duas colunas. No celular e no tablet devolve os filhos como estão (uma coluna).
 * Filhos vazios (`null`, `false`) não ocupam espaço.
 */
export function DesktopGrid({ children, desktop }: PropsWithChildren<{ desktop?: boolean }>) {
  const formFactor = useFormFactor();
  const items = Children.toArray(children);
  if (!(desktop ?? formFactor === "desktop")) return <>{items}</>;
  return (
    <View style={styles.grid}>
      {items.map((child, index) => <View key={index} style={styles.cell}>{child}</View>)}
    </View>
  );
}

/** PC: conteúdo principal à esquerda e uma coluna lateral fixa à direita. No celular, a lateral vem depois do principal. */
export function DesktopSplit({ main, aside, desktop }: { main: ReactNode; aside: ReactNode; desktop?: boolean }) {
  const formFactor = useFormFactor();
  if (!(desktop ?? formFactor === "desktop")) return <>{main}{aside}</>;
  return (
    <View style={styles.split}>
      <View style={styles.main}>{main}</View>
      <View style={styles.aside}>{aside}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  cell: { flexBasis: "47%", flexGrow: 1, minWidth: 280, gap: 16 },
  split: { flexDirection: "row", gap: 32, alignItems: "flex-start" },
  main: { flex: 1, minWidth: 0, gap: 24 },
  aside: { width: DESKTOP_ASIDE_WIDTH, flexShrink: 0, gap: 16 },
});
