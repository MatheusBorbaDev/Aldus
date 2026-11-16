import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SettingsGroup, SettingsLayout, SettingsLink } from '@/src/presentation/components/SettingsLayout';
import { MotionCuesControl } from '@/src/presentation/components/MotionCuesControl';
import { LibrarySyncControls } from '@/src/presentation/components/LibrarySyncControls';
import { useAppTheme } from '@/src/presentation/contexts/AppThemeContext';
import { appPaletteOptions, appPalettes } from '@/src/theme/tokens';

export default function PreferencesScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>(), { palette, mode, setMode, saveError, paletteName, setPaletteName, resolvedTheme } = useAppTheme();
  const title = section === 'sync' ? 'Sincronização' : section === 'comfort' ? 'Conforto durante a leitura' : section === 'services' ? 'Serviços de leitura' : 'Tema do aplicativo';
  return <SettingsLayout title={title}>
    {section === 'sync' ? <LibrarySyncControls /> : section === 'comfort' ? <MotionCuesControl color={palette.text} /> : section === 'services' ? <SettingsGroup title="Bibliotecas digitais">
      <SettingsLink title="BibliON" icon="library-outline" onPress={() => router.push('/services/biblion' as never)} />
      <SettingsLink title="MEC Livros" icon="school-outline" onPress={() => router.push('/services/mec' as never)} />
    </SettingsGroup> : <View style={{ gap: 12 }}><Text style={{ color: palette.secondaryText }}>Vale para o app e para os botões do leitor. As cores da página do livro continuam nos ajustes de leitura.</Text>
      <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 17, fontWeight: '700', marginTop: 4 }}>Paleta</Text>
      {appPaletteOptions.map(option => {
        const sample = appPalettes[option.value][resolvedTheme === 'dark' ? 'dark' : 'light'], checked = paletteName === option.value;
        return <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityHint={option.description} accessibilityState={{ checked }} onPress={() => setPaletteName(option.value)}
          style={{ minHeight: 64, borderRadius: 12, padding: 16, gap: 14, backgroundColor: palette.surface, borderWidth: checked ? 2 : 1, borderColor: checked ? palette.accent : palette.border, flexDirection: 'row', alignItems: 'center' }}>
          <View accessible={false} style={{ flexDirection: 'row' }}>{[sample.background, sample.surfaceSecondary, sample.accent].map((color, index) => <View key={index} style={{ width: 22, height: 22, borderRadius: 11, marginLeft: index ? -6 : 0, backgroundColor: color, borderWidth: 1, borderColor: palette.border }} />)}</View>
          <View style={{ flex: 1, gap: 2 }}><Text style={{ color: palette.text, fontWeight: checked ? '700' : '400' }}>{option.label}</Text><Text style={{ color: palette.secondaryText, fontSize: 13 }}>{option.description}</Text></View>
          <Text style={{ color: palette.accent }}>{checked ? '✓' : '○'}</Text>
        </Pressable>;
      })}
      <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 17, fontWeight: '700', marginTop: 8 }}>Claro ou escuro</Text>
      {([{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }] as const).map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: mode === option.value }} onPress={() => void setMode(option.value)} style={{ minHeight: 56, borderRadius: 12, padding: 16, backgroundColor: palette.surface, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: palette.text }}>{option.label}</Text><Text style={{ color: palette.accent }}>{mode === option.value ? '✓' : '○'}</Text></Pressable>)}
      {saveError ? <Text accessibilityRole="alert" style={{ color: palette.danger }}>{saveError}</Text> : null}
    </View>}
  </SettingsLayout>;
}
