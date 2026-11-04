import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { Reveal } from '../../components/Reveal';
import { ClassicSheet } from '../../components/ClassicSheet';
import { colors, fonts, type } from '../../../theme';
import { CLASSICS, useSavedClassics, type Classic } from '../../data/catalog';

export default function Catalog() {
  const [saved, toggle] = useSavedClassics();
  const [open, setOpen] = useState<Classic | null>(null);

  return (
    <Screen scene="ember">
      <PageHeader title="Classics" eyebrow="PUBLIC DOMAIN" fallback="/Test/upload" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Old stories with big casts. Exactly what Echo was made for.</Text>
        {CLASSICS.map((book, i) => (
          <Reveal key={book.id} index={i}>
            <View style={s.row}>
              <Pressable onPress={() => setOpen(book)} style={({ pressed }) => [s.tap, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                <View style={[s.cover, { backgroundColor: book.accent }]}>
                  <Ionicons name="book-outline" size={22} color="rgba(255,255,255,0.75)" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.title} numberOfLines={1}>{book.title}</Text>
                  <Text style={type.meta}>{book.author} · {book.year}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => toggle(book.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={saved.has(book.id) ? 'Remove from saved' : 'Save for later'}>
                <Ionicons name={saved.has(book.id) ? 'bookmark' : 'bookmark-outline'} size={22} color={saved.has(book.id) ? colors.gold : colors.dim} />
              </Pressable>
            </View>
          </Reveal>
        ))}
      </ScrollView>
      <ClassicSheet book={open} saved={open ? saved.has(open.id) : false} onToggle={() => open && toggle(open.id)} onClose={() => setOpen(null)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 220 },
  intro: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.dim, marginBottom: 6, marginLeft: 4 },
  tap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.18)' },
  cover: { width: 46, height: 62, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
});
