import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { colors, type } from '../../../theme';

type Props = {
  title: string; chapter: string; progress: number; isPlaying: boolean;
  onOpen?: () => void; onToggle?: () => void; onSkip?: () => void;
};

// Spotify-style bar. Sits directly above the tab bar (see (tabs)/_layout.tsx).
export function MiniPlayer({ title, chapter, progress, isPlaying, onOpen, onToggle, onSkip }: Props) {
  return (
    <Pressable onPress={onOpen} style={s.wrap}>
      <View style={s.row}>
        <LinearGradient colors={['#3A1B6E', '#7A3C9C']} style={s.cover} />
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { fontSize: 15 }]} numberOfLines={1}>{title}</Text>
          <Text style={[type.meta, { color: colors.blue }]} numberOfLines={1}>{chapter}</Text>
        </View>
        <Pressable onPress={onSkip} hitSlop={10}><Ionicons name="play-forward" size={22} color={colors.dim} /></Pressable>
        <Pressable onPress={onToggle} hitSlop={10} style={s.toggle}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#2A1258" />
        </Pressable>
      </View>
      <View style={{ marginTop: 8 }}><ProgressBar value={progress} height={3} /></View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  wrap: { marginHorizontal: 10, marginBottom: 6, padding: 10, borderRadius: 18, backgroundColor: '#3B1B63', borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 42, height: 42, borderRadius: 10 },
  toggle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
