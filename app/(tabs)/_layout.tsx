import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { useFeatureAccess } from "@/src/presentation/contexts/AuthContext";
import { ColorValue, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, typography } from "@/src/ui";
import { useFormFactor } from "@/src/presentation/layout/useFormFactor";
import { DesktopSidebar, DesktopSidebarProps } from "@/src/presentation/components/desktop/DesktopSidebar";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (outline: IconName, filled: IconName) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) =>
    <Ionicons name={focused ? filled : outline} size={size} color={color} />;

/**
 * Navegação principal: Biblioteca · Descobrir · Estudo · Comunidade · Conta.
 * Celular: barra inferior. Web ≥ 768 com toque: barra lateral (rótulo ao lado do ícone a partir de 1200).
 * PC (Web, janela ≥ 1024 e mouse): barra lateral própria do PC, com busca e estado do sincronismo.
 * Os nomes de rota (`library`, `search`, `study`, `community`, `settings`) são preservados por compatibilidade de links.
 */
export default function TabsLayout() {
  const { palette } = useAppTheme();
  const flashcards = useFeatureAccess("flashcards");
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = useFormFactor() === "desktop";
  const sidebar = Platform.OS === "web" && width >= layout.sidebarBreakpoint;
  const wideSidebar = sidebar && width >= 1200;
  const sidebarWidth = wideSidebar ? 220 : 96;

  return (
    <Tabs
      tabBar={desktop ? props => <DesktopSidebar {...(props as unknown as DesktopSidebarProps)} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: sidebar ? "left" : "bottom",
        tabBarVariant: sidebar ? "material" : "uikit",
        tabBarLabelPosition: wideSidebar ? "beside-icon" : "below-icon",
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.secondaryText,
        tabBarActiveBackgroundColor: sidebar ? palette.accentSoft : undefined,
        tabBarItemStyle: sidebar ? { borderRadius: 12, marginHorizontal: 10, marginVertical: 2, minHeight: 48 } : undefined,
        tabBarStyle: {
          backgroundColor: palette.tabBar,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          ...(sidebar
            ? { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth, borderTopWidth: 0, borderRightWidth: 1, borderRightColor: palette.border, paddingTop: 28 }
            : { height: 64 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6) }),
        },
        tabBarLabelStyle: { ...typography.caption, fontWeight: "600", fontSize: wideSidebar ? 14 : 12 },
      }}
    >
      <Tabs.Screen name="library" options={{ title: "Biblioteca", tabBarIcon: icon("library-outline", "library") }} />
      <Tabs.Screen name="search" options={{ title: "Descobrir", tabBarIcon: icon("compass-outline", "compass") }} />
      <Tabs.Screen name="study" options={{ title: "Estudo", tabBarIcon: icon("school-outline", "school") }} />
      <Tabs.Screen name="community" options={{ title: "Comunidade", tabBarIcon: icon("people-outline", "people") }} />
      <Tabs.Screen name="settings" options={{ title: "Conta", tabBarIcon: icon("person-circle-outline", "person-circle") }} />
    </Tabs>
  );
}
