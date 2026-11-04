import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { colors, fonts, type } from '../../../theme';
import { getCommunityBooks, getMyBooks } from '../../data';
import type { Book, CommunityBook } from '../../data/types';

type Result = { id: string; title: string; subtitle: string; kind: 'library' | 'community'; roomId?: string };

const SUGGESTIONS = ['mystery', 'fantasy', 'classic', 'romance'];

export default function Search() {
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState<Book[]>([]);
  const [community, setCommunity] = useState<CommunityBook[]>([]);

  useEffect(() => {
    getMyBooks().then(setMine, () => {});
    getCommunityBooks().then(setCommunity, () => {});
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hit = (...fields: (string | null | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(q));
    return [
      ...mine.filter((b) => hit(b.title, b.author, b.description)).map((b) => ({ id: b.id, title: b.title, subtitle: b.author ?? 'Unknown author', kind: 'library' as const })),
      ...community.filter((b) => hit(b.title, b.description, ...b.tags)).map((b) => ({ id: b.book_id, roomId: b.id, title: b.title, subtitle: b.tags.slice(0, 3).join(' · ') || 'Community', kind: 'community' as const })),
    ];
  }, [community, mine, query]);

  const open = (r: Result) =>
    r.kind === 'community' && r.roomId
      ? router.push({ pathname: '/Test/room', params: { id: r.roomId } })
      : router.push({ pathname: '/Test/book_details', params: { id: r.id, title: r.title, author: r.subtitle } });

  return (
    <Screen scene="aurora">
      <PageHeader title="Search" fallback="/Test/library" />
      <View style={s.field}>
        <Ionicons name="search" size={18} color={colors.dim} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Titles, authors, moods…" placeholderTextColor={colors.faint} style={s.input} autoFocus returnKeyType="search" autoCapitalize="none" />
        {query !== '' && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.faint} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {query.trim() === '' ? (
          <View style={{ gap: 12 }}>
            <Text style={s.section}>TRY</Text>
            <View style={s.chips}>
              {SUGGESTIONS.map((word) => (
                <Pressable key={word} onPress={() => setQuery(word)} style={s.chip} accessibilityRole="button">
                  <Text style={s.chipText}>{word}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : results.length === 0 ? (
          <EmptyState title="No stories by that name" body={`Nothing matched “${query.trim()}”. Try an author, or upload the book yourself.`} action="Upload a book" onAction={() => router.navigate('/Test/upload')} />
        ) : (
          results.map((r) => (
            <Pressable key={`${r.kind}-${r.id}`} onPress={() => open(r)} style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]} accessibilityRole="button">
              <View style={s.spine}><Ionicons name={r.kind === 'library' ? 'book' : 'people'} size={18} color={colors.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{r.title}</Text>
                <Text style={type.meta} numberOfLines={1}>{r.kind === 'library' ? `In your library · ${r.subtitle}` : `Book room · ${r.subtitle}`}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  field: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontFamily: fonts.sansMd, fontSize: 16, outlineStyle: 'none' } as object,
  page: { padding: 20, paddingBottom: 200 },
  section: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 2.2, color: colors.dim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.serifItalic, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.18)' },
  spine: { width: 42, height: 54, borderRadius: 8, backgroundColor: 'rgba(155,107,214,0.35)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 17, color: colors.text, marginBottom: 3 },
});
