import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { colors, gradients, type } from '../../../theme';

type Props = { title: string; chapter: string; timeLeft: string; progress: number; onPress?: () => void };

export function ContinueCard({ title, chapter, timeLeft, progress, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={s.card}>
      <LinearGradient colors={['#3A1B6E', '#7A3C9C']} style={s.cover} />
      <View style={{ flex: 1 }}>
        <Text style={type.title} numberOfLines={1}>{title}</Text>
        <Text style={type.body} numberOfLines={1}>{chapter}</Text>
        <View style={{ marginVertical: 8 }}><ProgressBar value={progress} /></View>
        <Text style={type.meta}>{timeLeft} left</Text>
      </View>
      <LinearGradient colors={gradients.cta} style={s.play}>
        <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
      </LinearGradient>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  cover: { width: 64, height: 64, borderRadius: 14 },
  play: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
