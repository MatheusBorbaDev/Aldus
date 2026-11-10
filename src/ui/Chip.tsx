import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PropsWithChildren, useState } from "react";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AppText } from "./Text";
import type { IconName } from "./Button";
import { radius, space, touchTarget } from "./tokens";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress(): void;
  icon?: IconName;
  disabled?: boolean;
  /** Texto extra para leitores de tela (ex.: "indisponível"). */
  accessibilityHint?: string;
}

/** Filtro/alternância compacta. Seleção indicada por cor E por ícone (não só cor). */
export function Chip({ label, selected = false, onPress, icon, disabled = false, accessibilityHint }: ChipProps) {
  const { palette } = useAppTheme();
  const ink = selected ? palette.accent : palette.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: palette.separator }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? palette.accentSoft : palette.surface,
          borderColor: selected ? palette.accent : palette.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={15} color={ink} /> : icon ? <Ionicons name={icon} size={15} color={ink} /> : null}
      <AppText variant="label" style={{ color: ink }} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

/** Linha de chips com rolagem horizontal (não quebra layout em telas estreitas). */
export function ChipRow({ children, label }: PropsWithChildren<{ label?: string }>) {
  const { palette } = useAppTheme();
  // Quando há chips além da borda, um esmaecido à direita indica que a linha rola (antes o último chip só aparecia cortado).
  const [width, setWidth] = useState(0), [content, setContent] = useState(0), [offset, setOffset] = useState(0);
  const more = content > width + 1 && offset + width < content - 4;
  return (
    <View style={styles.rowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={label}
        contentContainerStyle={styles.row}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={value => setContent(value)}
        onScroll={event => setOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>
      {more ? (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fade}>
          <View style={[styles.fadeStep, { backgroundColor: palette.background, opacity: 0.35 }]} />
          <View style={[styles.fadeStep, { backgroundColor: palette.background, opacity: 0.65 }]} />
          <View style={[styles.fadeStep, { backgroundColor: palette.background, opacity: 0.9 }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget - 8,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
  },
  row: { gap: space.sm, paddingVertical: space.xs, alignItems: "center" },
  rowWrap: { position: "relative" },
  fade: { position: "absolute", top: 0, bottom: 0, right: 0, width: 36, flexDirection: "row" },
  fadeStep: { flex: 1 },
});
