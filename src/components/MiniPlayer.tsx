import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { colors, type } from '../../theme';
import { playback, useNowPlaying } from '../data/playback';
import { useSettings } from '../data/settings';

// Spotify-style bar. Sits directly above the tab bar (see (tabs)/_layout.tsx) and takes the active tab's accent.
// The open area and the controls are sibling buttons: nesting them would put a <button> inside a <button> on web.
export function MiniPlayer({ accent = colors.blue, onOpen }: { accent?: string; onOpen?: () => void }) {
  const now = useNowPlaying();
  const [settings] = useSettings();
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Pressable onPress={onOpen} style={s.open} accessibilityRole="button" accessibilityLabel={`Open player: ${now.title}`}>
          <View style={[s.cover, { backgroundColor: accent }]} />
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { fontSize: 15 }]} numberOfLines={1}>{now.title}</Text>
            <Text style={[type.meta, { color: accent }]} numberOfLines={1}>Chapter {now.chapterNumber} · {now.chapter}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => playback.skip(settings.skipSeconds)} hitSlop={10} accessibilityLabel={`Skip ${settings.skipSeconds} seconds`}>
          <Ionicons name="play-forward" size={22} color={colors.dim} />
        </Pressable>
        <Pressable onPress={playback.toggle} hitSlop={10} style={s.toggle} accessibilityLabel={now.isPlaying ? 'Pause' : 'Play'}>
          <Ionicons name={now.isPlaying ? 'pause' : 'play'} size={20} color="#14102A" style={!now.isPlaying && { marginLeft: 2 }} />
        </Pressable>
      </View>
      <View style={{ marginTop: 8 }}><ProgressBar value={now.positionSec / now.durationSec} height={3} /></View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { marginHorizontal: 10, marginBottom: 6, padding: 10, borderRadius: 12, backgroundColor: 'rgba(16,14,34,0.92)', borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 42, height: 42, borderRadius: 6 },
  toggle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
