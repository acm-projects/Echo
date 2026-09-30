import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressBar } from './ProgressBar';
import { colors, fonts, type } from '../theme';

type Props = { title: string; author: string; progress?: number; tint: readonly [string, string]; onPress?: () => void };

export function BookCard({ title, author, progress = 0, tint, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={s.card}>
      <LinearGradient colors={tint} style={s.cover}>
        <View style={s.badge}><Text style={s.badgeText}>Audio</Text></View>
      </LinearGradient>
      <View style={s.info}>
        <Text style={type.title} numberOfLines={1}>{title}</Text>
        <Text style={[type.body, { fontSize: 13 }]} numberOfLines={1}>{author}</Text>
        <View style={{ marginTop: 8 }}><ProgressBar value={progress} /></View>
      </View>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: { width: '48%', borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 14 },
  cover: { aspectRatio: 1, alignItems: 'flex-end', padding: 10 },
  badge: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 11 },
  info: { padding: 12 },
});
