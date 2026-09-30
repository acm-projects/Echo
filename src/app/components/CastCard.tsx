import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, type } from '..//theme';

type Props = { name: string; role: string; voice: string; roleColor?: string; avatarColor?: string; onPlay?: () => void };

export function CastCard({ name, role, voice, roleColor = colors.pink, avatarColor = '#4B2A3F', onPlay }: Props) {
  return (
    <View style={s.card}>
      <View style={[s.avatar, { backgroundColor: avatarColor }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={type.title}>{name}</Text>
        <View style={[s.pill, { backgroundColor: roleColor }]}><Text style={s.pillText}>{role}</Text></View>
        <Text style={type.body} numberOfLines={2}>{voice}</Text>
      </View>
      <Pressable onPress={onPlay} style={s.play} hitSlop={8}>
        <Ionicons name="play" size={18} color={colors.pink} style={{ marginLeft: 2 }} />
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  pill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: fonts.sansBold, fontSize: 11, color: '#2A1258' },
  play: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
});
