import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { colors, fonts } from '../../theme';

// Back button + title for pages pushed on top of the tabs. Falls back to `fallback` when opened directly by URL.
export function PageHeader({ title, eyebrow, right, fallback = '/Test/library' }: { title: string; eyebrow?: string; right?: ReactNode; fallback?: Href }) {
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback));
  return (
    <View style={s.row}>
      <Pressable onPress={back} style={s.round} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2.5, color: colors.pink, marginBottom: 2 },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.text },
});
