import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { googleDrive } from "@/src/data/drive/driveDependencies";
import { DriveError } from "@/src/data/drive/DriveErrors";
import type { DriveBrowseFolder } from "@/src/data/drive/GoogleDriveService";

type Area = "mine" | "shared";
const AREA_LABEL: Record<Area, string> = { mine: "Meu Drive", shared: "Compartilhados comigo" };

/**
 * Escolher a pasta do Drive navegando (pedido do dono, 18/11/2026: colar o link era difícil). Lista só pastas, um nível por vez,
 * com a conexão já feita nesta tela; a raiz de cada área não pode ser escolhida, para nunca ler o Drive inteiro.
 */
export function DriveFolderPicker({ sourceId, disabled, onChoose }: { sourceId: string; disabled: boolean; onChoose: (folder: DriveBrowseFolder) => void }) {
  const { palette } = useAppTheme();
  const [area, setArea] = useState<Area>("mine");
  const [trail, setTrail] = useState<DriveBrowseFolder[]>([]);
  const [folders, setFolders] = useState<DriveBrowseFolder[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const current = trail.at(-1);

  const load = (pageToken?: string) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null);
    if (!pageToken) { setFolders([]); setNext(undefined); }
    googleDrive.browseFolders(sourceId, { area, folderId: current?.id, resourceKey: current?.resourceKey }, pageToken, controller.signal)
      .then(page => {
        if (request.current !== controller) return;
        setFolders(previous => pageToken ? [...previous, ...page.folders.filter(item => !previous.some(old => old.id === item.id))] : page.folders);
        setNext(page.nextPageToken);
      })
      .catch(failure => { if (request.current === controller && !controller.signal.aborted) setError(failure instanceof DriveError ? failure.message : "Não foi possível listar as pastas. Tente novamente."); })
      .finally(() => { if (request.current === controller) { request.current = null; setLoading(false); } });
  };
  useEffect(() => { load(); return () => request.current?.abort(); }, [sourceId, area, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeArea = (value: Area) => { if (value === area) return; setTrail([]); setArea(value); };
  const crumb = (label: string, depth: number, last: boolean) => (
    <Pressable key={`${depth}-${label}`} accessibilityRole="button" accessibilityLabel={last ? `${label}, pasta atual` : `Voltar para ${label}`} disabled={last || disabled}
      onPress={() => setTrail(trail.slice(0, depth))} style={styles.crumb}>
      <Text numberOfLines={1} style={{ color: last ? palette.text : palette.accent, fontWeight: last ? "700" : "500", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View accessibilityLabel="Escolha uma pasta do Google Drive" style={[styles.box, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Escolha uma pasta</Text>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {(Object.keys(AREA_LABEL) as Area[]).map(value => (
          <Pressable key={value} accessibilityRole="tab" accessibilityLabel={AREA_LABEL[value]} accessibilityState={{ selected: area === value, disabled }} disabled={disabled}
            onPress={() => changeArea(value)} style={[styles.tab, { borderColor: area === value ? palette.accent : palette.border, backgroundColor: area === value ? palette.surfaceSecondary : "transparent" }]}>
            <Text style={{ color: area === value ? palette.accent : palette.text, fontWeight: area === value ? "700" : "500", fontSize: 13 }}>{AREA_LABEL[value]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.crumbs}>
        {crumb(AREA_LABEL[area], 0, trail.length === 0)}
        {trail.map((folder, index) => <View key={folder.id} style={styles.crumbItem}><Text style={{ color: palette.secondaryText }}>›</Text>{crumb(folder.name, index + 1, index === trail.length - 1)}</View>)}
      </View>
      {error ? <View style={{ gap: 8 }}>
        <Text accessibilityRole="alert" style={{ color: palette.text, lineHeight: 20 }}>{error}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tentar listar as pastas de novo" disabled={disabled || loading} onPress={() => load()} style={[styles.more, { borderColor: palette.border }]}><Text style={{ color: palette.accent, fontWeight: "600" }}>Tentar de novo</Text></Pressable>
      </View> : null}
      {!error && !loading && folders.length === 0 ? <Text style={{ color: palette.secondaryText, lineHeight: 20 }}>{trail.length ? "Esta pasta não tem subpastas." : area === "shared" ? "Nenhuma pasta foi compartilhada com esta conta." : "Nenhuma pasta no seu Drive."}</Text> : null}
      <View>
        {folders.map(folder => (
          <Pressable key={folder.id} accessibilityRole="button" accessibilityLabel={`Abrir pasta ${folder.name}`} disabled={disabled}
            onPress={() => setTrail([...trail, folder])} android_ripple={{ color: palette.separator }} style={[styles.row, { borderBottomColor: palette.separator }]}>
            <Ionicons name="folder-outline" size={22} color={palette.accent} />
            <Text numberOfLines={2} style={{ color: palette.text, flex: 1, fontSize: 15 }}>{folder.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={palette.secondaryText} />
          </Pressable>
        ))}
      </View>
      {loading ? <View style={styles.loading}><ActivityIndicator color={palette.accent} /><Text style={{ color: palette.secondaryText }}>Carregando pastas…</Text></View> : null}
      {next && !loading ? <Pressable accessibilityRole="button" accessibilityLabel="Carregar mais pastas" disabled={disabled} onPress={() => load(next)} style={[styles.more, { borderColor: palette.border }]}><Text style={{ color: palette.accent, fontWeight: "600" }}>Carregar mais pastas</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={current ? `Usar a pasta ${current.name}` : "Entre em uma pasta para usá-la"} accessibilityState={{ disabled: disabled || !current }}
        disabled={disabled || !current} onPress={() => current && onChoose(current)} style={[styles.use, { backgroundColor: palette.accent, opacity: disabled || !current ? 0.5 : 1 }]}>
        <Text style={styles.useText}>{current ? `Usar a pasta “${current.name}”` : "Entre em uma pasta para usá-la"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: "700" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, justifyContent: "center" },
  crumbs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  crumbItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  crumb: { minHeight: 36, justifyContent: "center", maxWidth: 220 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  loading: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  more: { minHeight: 44, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  use: { minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 11 },
  useText: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },
});
