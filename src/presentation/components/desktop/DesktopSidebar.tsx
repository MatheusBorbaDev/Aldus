import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { useLibrarySync } from "@/src/presentation/components/LibrarySyncControls";
import { numberLabel } from "@/src/presentation/i18n/ptBR";
import { radius, space, typography } from "@/src/ui";

/** Largura fixa da barra lateral do PC: rótulos inteiros, sem ícone sozinho. */
export const DESKTOP_SIDEBAR_WIDTH = 248;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface SidebarRoute { key: string; name: string; params?: object }
interface SidebarDescriptor { options: { title?: string; tabBarItemStyle?: unknown; tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode } }
export interface DesktopSidebarProps {
  state: { index: number; routes: SidebarRoute[] };
  descriptors: Record<string, SidebarDescriptor>;
  navigation: { emit(event: { type: "tabPress"; target: string; canPreventDefault: true }): { defaultPrevented: boolean }; navigate(name: string, params?: object): void };
}

/** A aba some quando a rota tem `href: null` (ex.: Estudo sem acesso): o expo-router a marca com `display: none`. */
export function visibleSidebarRoutes(props: DesktopSidebarProps): SidebarRoute[] {
  return props.state.routes.filter(route => {
    const style = props.descriptors[route.key]?.options.tabBarItemStyle as { display?: string } | undefined;
    return style?.display !== "none";
  });
}

/** Texto curto do estado do sincronismo, o mesmo da Conta, sempre à vista no PC. */
export function sidebarSyncLabel(status: { running: boolean; pending: number; lastSync: string | number | null | undefined; error: string | null | undefined }): string {
  if (status.running) return "Sincronizando…";
  if (status.error) return "Sincronização com erro";
  if (status.pending) return `${numberLabel(status.pending)} ${status.pending === 1 ? "alteração pendente" : "alterações pendentes"}`;
  return status.lastSync ? "Biblioteca sincronizada" : "Ainda não sincronizada";
}

/**
 * Navegação do PC: marca, busca de livros (Ctrl+K), as cinco seções com rótulo e o estado do sincronismo no rodapé.
 * Substitui só a barra de abas; cada tela continua a mesma rota, com os mesmos dados.
 */
export function DesktopSidebar(props: DesktopSidebarProps) {
  const { palette } = useAppTheme();
  const [query, setQuery] = useState("");
  const input = useRef<TextInput>(null);
  const routes = visibleSidebarRoutes(props);
  const activeKey = props.state.routes[props.state.index]?.key;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const search = () => {
    const text = query.trim();
    if (text.length < 2) return;
    router.push({ pathname: "/catalog", params: { q: text.slice(0, 200) } } as never);
  };
  const open = (route: SidebarRoute) => {
    const event = props.navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (route.key !== activeKey && !event.defaultPrevented) props.navigation.navigate(route.name, route.params);
  };

  return (
    <View role="navigation" aria-label="Seções do Aldus" style={[styles.bar, { backgroundColor: palette.tabBar, borderRightColor: palette.border }]}>
      <Text accessibilityRole="header" style={[typography.title, styles.brand, { color: palette.text }]}>Aldus</Text>
      <View style={[styles.search, { backgroundColor: palette.input, borderColor: palette.border }]}>
        <Ionicons name="search" size={16} color={palette.secondaryText} />
        <TextInput
          ref={input}
          accessibilityLabel="Buscar livros no catálogo"
          accessibilityHint="Atalho: Ctrl+K"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder="Buscar livros"
          placeholderTextColor={palette.secondaryText}
          returnKeyType="search"
          autoCorrect={false}
          style={[typography.bodySmall, styles.searchInput, { color: palette.text }]}
        />
        <Text style={[typography.caption, { color: palette.secondaryText }]}>Ctrl K</Text>
      </View>
      <View style={styles.nav}>
        {routes.map(route => {
          const options = props.descriptors[route.key]?.options ?? {};
          const focused = route.key === activeKey;
          const color = focused ? palette.accent : palette.secondaryText;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="link"
              accessibilityState={{ selected: focused }}
              {...({ "aria-current": focused ? "page" : undefined } as object)}
              accessibilityLabel={options.title ?? route.name}
              onPress={() => open(route)}
              style={({ hovered }: { hovered?: boolean }) => [styles.item, focused ? { backgroundColor: palette.accentSoft } : hovered ? { backgroundColor: palette.surfaceSecondary } : null]}
            >
              {options.tabBarIcon?.({ focused, color, size: 20 })}
              <Text style={[typography.label, { color: focused ? palette.text : palette.secondaryText, fontWeight: focused ? "700" : "600" }]}>{options.title ?? route.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <SidebarSyncStatus />
    </View>
  );
}

function SidebarSyncStatus() {
  const { palette } = useAppTheme();
  const sync = useLibrarySync();
  const label = sidebarSyncLabel({
    running: sync.status.running,
    pending: sync.engine.status.pending + sync.status.pendingFiles,
    lastSync: sync.engine.status.lastSync,
    error: sync.status.error || sync.engine.status.error,
  });
  const icon: IconName = sync.status.running ? "sync" : sync.status.error || sync.engine.status.error ? "alert-circle-outline" : "cloud-done-outline";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Abrir sincronização na Conta`}
      onPress={() => router.push("/settings")}
      style={({ hovered }: { hovered?: boolean }) => [styles.sync, { borderTopColor: palette.border }, hovered ? { backgroundColor: palette.surfaceSecondary } : null]}
    >
      <Ionicons name={icon} size={18} color={palette.secondaryText} />
      <Text numberOfLines={2} style={[typography.caption, styles.syncText, { color: palette.secondaryText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { width: DESKTOP_SIDEBAR_WIDTH, minWidth: DESKTOP_SIDEBAR_WIDTH, maxWidth: DESKTOP_SIDEBAR_WIDTH, height: "100%", borderRightWidth: 1, paddingTop: space.xl },
  brand: { paddingHorizontal: space.xl, marginBottom: space.lg },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, marginHorizontal: space.md, marginBottom: space.lg, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.md, borderWidth: 1 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: space.sm },
  nav: { flex: 1, gap: space.xxs, paddingHorizontal: space.md },
  item: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md },
  sync: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.lg, borderTopWidth: 1, minHeight: 56 },
  syncText: { flex: 1 },
});
