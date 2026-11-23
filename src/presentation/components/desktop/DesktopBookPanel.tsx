import { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { AppText, Button, IconButton, space } from "@/src/ui";

/** Largura do painel de detalhes da Biblioteca do PC. */
export const DESKTOP_BOOK_PANEL_WIDTH = 340;

export interface DesktopBookPanelProps {
  title: string;
  author: string;
  /** Capa já montada pela tela (a mesma do cartão). */
  cover: ReactNode;
  /** Linhas "rótulo: valor" só com o que existe; nada é estimado para preencher espaço. */
  details: Array<{ label: string; value: string }>;
  readLabel: string;
  onRead(): void;
  onOrganize(): void;
  organizeDisabled?: boolean;
  onClose(): void;
  /** Estado na nuvem e menu "⋯" (os mesmos controles do cartão). */
  footer?: ReactNode;
}

/**
 * Painel à direita da Biblioteca do PC (23/11/2026): o livro clicado, sem sair da lista. Clique duplo, Enter ou "Ler" abrem o
 * livro; Esc ou "Fechar painel" fecham. No celular não existe: lá o toque abre o livro, como sempre.
 */
export function DesktopBookPanel({ title, author, cover, details, readLabel, onRead, onOrganize, organizeDisabled, onClose, footer }: DesktopBookPanelProps) {
  const { palette } = useAppTheme();
  return (
    <View role="complementary" aria-label={`Detalhes de ${title}`} style={[styles.panel, { backgroundColor: palette.surface, borderLeftColor: palette.border }]}>
      <View style={styles.top}>
        <AppText variant="overline" tone="secondary">Detalhes do livro</AppText>
        <IconButton icon="close" label="Fechar painel" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.cover}>{cover}</View>
        <View style={styles.titles}>
          <AppText variant="heading">{title}</AppText>
          {author ? <AppText variant="bodySmall" tone="secondary">{author}</AppText> : null}
        </View>
        <View style={styles.actions}>
          <Button label={readLabel} icon="book-outline" variant="primary" onPress={onRead} />
          <Button label="Organizar" icon="pricetag-outline" onPress={onOrganize} disabled={organizeDisabled} />
        </View>
        {details.length ? (
          <View style={styles.details}>
            {details.map(item => (
              <View key={item.label} style={styles.detail}>
                <AppText variant="caption" tone="secondary">{item.label}</AppText>
                <AppText variant="bodySmall">{item.value}</AppText>
              </View>
            ))}
          </View>
        ) : null}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: DESKTOP_BOOK_PANEL_WIDTH, minWidth: DESKTOP_BOOK_PANEL_WIDTH, maxWidth: DESKTOP_BOOK_PANEL_WIDTH, borderLeftWidth: 1, height: "100%" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: space.xl, paddingRight: space.sm, paddingTop: space.md },
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.lg },
  cover: { width: 160, height: 240, alignSelf: "center", borderRadius: 8, overflow: "hidden" },
  titles: { gap: space.xs },
  actions: { gap: space.sm },
  details: { gap: space.md },
  detail: { gap: space.xxs },
});
