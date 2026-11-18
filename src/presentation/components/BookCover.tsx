import { memo, useState } from 'react';
import { ActivityIndicator, Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { editorialCover } from './bookCoverPresentation';
import type { AldusCoverDesign } from '@/src/domain/catalog/defaultCover';

interface Props {
  identity: string;
  title: string;
  author?: string;
  format: string;
  source?: ImageSourcePropType | null;
  thumbnail?: ImageSourcePropType | null;
  compact?: boolean;
}

export const BookCover = memo(function BookCover(props: Props) {
  // Source identity resets loading/failure when a virtualized card is reused.
  const primary = imageIdentity(props.source), thumbnail = imageIdentity(props.thumbnail);
  const [version, setVersion] = useState({ primary, thumbnail, number: 0 });
  if (primary !== version.primary || thumbnail !== version.thumbnail) {
    setVersion({ primary, thumbnail, number: version.number + 1 });
  }
  return <CoverSurface key={`${props.identity}:${version.number}`} {...props} />;
});

function imageIdentity(source: Props['source']) {
  return source && typeof source === 'object' && 'uri' in source ? source.uri : source;
}

function CoverSurface({ identity, title, author, format, source, thumbnail, compact }: Props) {
  const design = editorialCover(identity, title, author);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const [width, setWidth] = useState(0);
  const candidates = [source, thumbnail];
  const index = candidates.findIndex((candidate, i) => !!candidate && !failed.has(i));
  const selected = index < 0 ? null : candidates[index];
  const reject = () => { setLoaded(false); setFailed(previous => new Set(previous).add(index)); };
  return <View testID="book-cover" accessibilityLabel={`Capa de ${design.title}`} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.surface, { backgroundColor: design.paper }]}>
    {width > 0 ? <AldusDefaultCover design={design} format={format} width={width} compact={!!compact} /> : null}
    {selected ? <Image key={index} source={selected} resizeMode="contain" resizeMethod="resize" fadeDuration={0} accessibilityIgnoresInvertColors
      style={[StyleSheet.absoluteFill, styles.image, { opacity: loaded ? 1 : 0, backgroundColor: design.paper }]}
      onLoad={event => {
        // React Native Web forwards the DOM image event instead of a native source.
        const native = event.nativeEvent as typeof event.nativeEvent & {
          target?: { naturalWidth?: number; naturalHeight?: number };
        };
        const width = native?.source?.width ?? native?.target?.naturalWidth;
        const height = native?.source?.height ?? native?.target?.naturalHeight;
        if (typeof width !== 'number' || typeof height !== 'number' || !Number.isFinite(width) || !Number.isFinite(height) || width < 96 || height < 96) reject();
        else setLoaded(true);
      }} onError={reject} /> : null}
    {selected && !loaded ? <ActivityIndicator testID="book-cover-loading" size="small" color={design.ink} style={styles.loading} /> : null}
  </View>;
}

/**
 * Capa padrão Aldus (aprovada em 18/11/2026) desenhada com componentes nativos, proporcional à largura (o desenho tem 400 de
 * largura). O rótulo do topo é o formato do arquivo, um dado real; nunca uma categoria inventada.
 */
function AldusDefaultCover({ design, format, width, compact }: { design: AldusCoverDesign; format: string; width: number; compact: boolean }) {
  const u = width / 400, p = design.palette, hair = Math.max(StyleSheet.hairlineWidth, 0.8 * u);
  const titleSize = Math.max(compact ? 9 : 10, design.titleSize * u * (compact ? 1.1 : 1));
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={[styles.glow, { backgroundColor: p.glow, width: 560 * u, height: 560 * u, borderRadius: 280 * u, left: -80 * u, top: -170 * u }]} />
    <View style={[styles.frame, { borderColor: p.accent, borderWidth: Math.max(1, 1.6 * u), top: 18 * u, left: 18 * u, right: 18 * u, bottom: 18 * u }]} />
    <View style={[styles.frame, { borderColor: p.accent, borderWidth: hair, opacity: 0.55, top: 25 * u, left: 25 * u, right: 25 * u, bottom: 25 * u }]} />
    {!compact ? <View style={[styles.band, { left: 30 * u, right: 30 * u, bottom: 30 * u, height: 115 * u, borderTopColor: p.accent, borderTopWidth: hair }]}>
      <CoverOrnament kind={design.ornament} color={p.accent} u={u} />
    </View> : null}
    <View style={[styles.column, { paddingHorizontal: 44 * u, paddingTop: (compact ? 46 : 58) * u, paddingBottom: (compact ? 40 : 160) * u }]}>
      <Text numberOfLines={1} style={[styles.label, { color: p.accent, fontSize: Math.max(6, 11 * u), letterSpacing: 3.4 * u }]}>{format.toUpperCase()}</Text>
      <View style={{ width: 100 * u, height: hair, backgroundColor: p.accent, opacity: 0.7, marginTop: 10 * u }} />
      <View style={styles.middle}>
        <Text numberOfLines={compact ? 4 : design.titleLines} style={[styles.coverTitle, { color: p.text, fontSize: titleSize, lineHeight: titleSize * 1.18 }]}>{design.title}</Text>
        {!compact ? <>
          <View style={[styles.ornamentRow, { marginTop: 18 * u, gap: 6 * u }]}>
            <View style={{ width: 36 * u, height: hair, backgroundColor: p.accent }} />
            <View style={{ width: 7 * u, height: 7 * u, backgroundColor: p.accent, transform: [{ rotate: '45deg' }] }} />
            <View style={{ width: 36 * u, height: hair, backgroundColor: p.accent }} />
          </View>
          <Text numberOfLines={2} style={[styles.coverAuthor, { color: p.text, fontSize: Math.max(6, 13 * u), lineHeight: Math.max(8, 19 * u), letterSpacing: 2.6 * u, marginTop: 16 * u }]}>{design.author.toLocaleUpperCase('pt-BR')}</Text>
        </> : null}
      </View>
    </View>
    {!compact ? <Text style={[styles.mark, { color: p.accent, fontSize: Math.max(5, 9.5 * u), letterSpacing: 4 * u, bottom: 38 * u }]}>ALDUS</Text> : null}
  </View>;
}

function CoverOrnament({ kind, color, u }: { kind: AldusCoverDesign['ornament']; color: string; u: number }) {
  if (kind === 'arcos') return <>{Array.from({ length: 9 }, (_, i) => {
    const r = (70 + i * 22) * u;
    return <View key={i} style={{ position: 'absolute', left: 170 * u - r, top: 165 * u - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: Math.max(StyleSheet.hairlineWidth, u), borderColor: color, opacity: 0.34 - i * 0.03 }} />;
  })}</>;
  if (kind === 'trelica') return <>{Array.from({ length: 13 }, (_, i) => [45, -45].map(angle => (
    <View key={`${i}:${angle}`} style={{ position: 'absolute', left: (i * 30 - 60) * u, top: 57 * u, width: 170 * u, height: Math.max(StyleSheet.hairlineWidth, u), backgroundColor: color, opacity: 0.22, transform: [{ rotate: `${angle}deg` }] }} />
  )))}</>;
  return <>{Array.from({ length: 25 }, (_, i) => {
    const angle = 180 + (i / 24) * 180, rad = angle * Math.PI / 180, len = 260 * u;
    const cx = 170 * u + Math.cos(rad) * len / 2, cy = 135 * u + Math.sin(rad) * len / 2;
    return <View key={i} style={{ position: 'absolute', left: cx - len / 2, top: cy, width: len, height: Math.max(StyleSheet.hairlineWidth, u), backgroundColor: color, opacity: 0.2, transform: [{ rotate: `${angle}deg` }] }} />;
  })}</>;
}

const styles = StyleSheet.create({
  surface: { flex: 1, width: '100%', overflow: 'hidden' },
  glow: { position: 'absolute', opacity: 0.55 },
  frame: { position: 'absolute' },
  band: { position: 'absolute', overflow: 'hidden' },
  column: { flex: 1, alignItems: 'center' },
  label: { fontFamily: 'serif', textAlign: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  coverTitle: { fontFamily: 'serif', fontWeight: '600', textAlign: 'center' },
  ornamentRow: { flexDirection: 'row', alignItems: 'center' },
  coverAuthor: { fontFamily: 'serif', textAlign: 'center', opacity: 0.86 },
  mark: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: 'serif' },
  image: { width: '100%', height: '100%' },
  loading: { position: 'absolute', right: 8, bottom: 8 },
});
