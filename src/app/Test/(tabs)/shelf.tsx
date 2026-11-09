import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../../../components/Screen';
import { Reveal } from '../../../components/Reveal';
import { Jacket } from '../../../components/Jacket';
import { CityLoader } from '../../../components/CityLoader';
import { colors, fonts, radius, scenes } from '../../../../theme';
import { loadShelf, type DisplayBook } from '../../../data/shelf';
import { resumeBook } from '../../../data/resume';
import { supabase } from '../../../../lib/supabase';

const accent = scenes.aurora.accent;

type Filter = 'all' | 'progress' | 'new' | 'done' | 'processing';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'progress', label: 'In progress' },
  { id: 'new', label: 'Not started' },
  { id: 'done', label: 'Completed' },
  { id: 'processing', label: 'Processing' },
];

const matches = (book: DisplayBook, filter: Filter) => {
  if (filter === 'processing') return book.status !== 'ready';
  if (book.status !== 'ready') return filter === 'all';
  if (filter === 'progress') return book.progress > 0 && book.progress < 100;
  if (filter === 'new') return book.progress === 0;
  if (filter === 'done') return book.progress >= 100;
  return true;
};

function openBook(book: DisplayBook) {
  router.push({ pathname: '/Test/book_details', params: { id: book.id, title: book.title, author: book.author ?? 'Unknown author', progress: String(book.progress) } });
}

// The reader's own books: how far along they are, the one to pick back up, and everything else on the shelf.
export default function Shelf() {
  const { width } = useWindowDimensions();
  const [books, setBooks] = useState<DisplayBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(() => {
    setError(null);
    loadShelf().then(setBooks, () => setError('Could not load your books. Please try again.'));
  }, []);
  // Reloaded whenever the tab comes back into view or the session changes, so a book that just finished shows up.
  useFocusEffect(load);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load();
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const stats = useMemo(() => {
    const list = books ?? [];
    return [
      { label: 'Books', value: list.length },
      { label: 'In progress', value: list.filter((b) => b.progress > 0 && b.progress < 100).length },
      { label: 'Finished', value: list.filter((b) => b.progress >= 100).length },
    ];
  }, [books]);
  const current = books?.find((b) => b.progress > 0 && b.progress < 100);
  const shown = (books ?? []).filter((b) => matches(b, filter) && `${b.title} ${b.author ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const cover = (width - 40 - 14) / 2;

  const resume = (book: DisplayBook) => {
    void resumeBook(book);
    router.push('/Test/player');
  };

  return (
    <Screen scene="aurora">
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.eyebrow}>YOUR SHELF</Text>
        <Text style={s.title}>Your books</Text>

          <View style={s.stats}>
            {stats.map((stat, i) => (
              <View key={stat.label} style={[s.stat, i > 0 && s.statRule]}>
                <Text style={s.statValue}>{books ? stat.value : '–'}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

        {current && (
          <Reveal>
            <Text style={s.sectionTitle}>Continue listening</Text>
            <Text style={s.sectionSubtitle}>Pick up right where you left off</Text>
            <Pressable style={s.continue} onPress={() => resume(current)} accessibilityRole="button" accessibilityLabel={`Continue ${current.title}`}>
              <Jacket title={current.title} author={current.author} accent={current.accent} width={74} />
              <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
                <Text style={[s.label, { color: accent }]}>IN PROGRESS</Text>
                <Text style={s.bookTitle} numberOfLines={2}>{current.title}</Text>
                <Text style={s.bookAuthor}>{current.author}</Text>
                <View style={s.progressRow}>
                  <View style={s.track}><View style={[s.fill, { width: `${current.progress}%` }]} /></View>
                  <Text style={s.percent}>{current.progress}%</Text>
                </View>
                <View style={s.link}>
                  <Ionicons name="play" size={12} color={accent} />
                  <Text style={s.linkText}>Continue story</Text>
                  <Ionicons name="chevron-forward" size={14} color={accent} />
                </View>
              </View>
            </Pressable>
          </Reveal>
        )}

        <Reveal index={1}>
          <Text style={[s.sectionTitle, { marginTop: 26 }]}>My books</Text>
          <Text style={s.sectionSubtitle}>All the stories on your shelf</Text>
          <View style={s.search}>
            <Ionicons name="search" size={18} color={colors.dim} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search your shelf…" placeholderTextColor={colors.faint} style={s.input} autoCapitalize="none" />
            {query !== '' && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {FILTERS.map((f) => {
              const on = f.id === filter;
              return (
                <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.chipText, on && { color: '#0E1A16' }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {error ? (
            <View style={s.empty}>
              <Text style={s.emptyBody}>{error}</Text>
              <Pressable onPress={load} accessibilityRole="button"><Text style={s.clear}>Try again</Text></Pressable>
            </View>
          ) : !books ? (
            <CityLoader scene="aurora" label="Fetching your shelf…" />
          ) : shown.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="search" size={26} color={colors.dim} />
              <Text style={s.emptyTitle}>No matching books</Text>
              <Text style={s.emptyBody}>Try a different search or filter.</Text>
              <Pressable onPress={() => { setQuery(''); setFilter('all'); }} accessibilityRole="button"><Text style={s.clear}>Clear filters</Text></Pressable>
            </View>
          ) : (
            <View style={s.grid}>
              {shown.map((book) => (
                <Pressable key={book.id} style={({ pressed }) => [{ width: cover }, pressed && { transform: [{ translateY: -4 }] }]} onPress={() => openBook(book)} accessibilityRole="button" accessibilityLabel={`${book.title}, ${book.progress}% listened`}>
                  <Jacket title={book.title} author={book.author} accent={book.accent} width={cover} />
                  {book.progress > 0 && book.progress < 100 && <View style={[s.ribbon, { height: 16 + book.progress * 0.4 }]} />}
                  <Text style={s.gridTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={s.gridMeta}>{book.status !== 'ready' ? 'Processing…' : book.progress >= 100 ? 'Finished' : book.progress > 0 ? `${book.progress}% listened` : 'Not started'}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 200 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2.5, color: accent },
  title: { fontFamily: fonts.display, fontSize: 36, letterSpacing: -0.5, color: '#FFFFFF', marginTop: 4, marginBottom: 18 },
  stats: { flexDirection: 'row', paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 24 },
  stat: { flex: 1, alignItems: 'center' },
  statRule: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.2)' },
  statValue: { fontFamily: fonts.display, fontSize: 28, color: '#FFFFFF' },
  statLabel: { fontFamily: fonts.sansMd, fontSize: 12, color: colors.dim },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: '#FFFFFF' },
  sectionSubtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, marginTop: 2, marginBottom: 12 },
  continue: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 2 },
  bookTitle: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 22, color: '#FFFFFF' },
  bookAuthor: { fontFamily: fonts.serifItalic, fontSize: 13, color: colors.dim },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: accent },
  percent: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.dim },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  linkText: { fontFamily: fonts.sansBold, fontSize: 13, color: accent },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontFamily: fonts.sansMd, fontSize: 15, outlineStyle: 'none' } as object,
  chips: { gap: 8, paddingVertical: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { backgroundColor: accent, borderColor: accent },
  chipText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  ribbon: { position: 'absolute', top: 0, right: 12, width: 7, backgroundColor: colors.gold },
  gridTitle: { fontFamily: fonts.serif, fontSize: 15, color: '#FFFFFF', marginTop: 8 },
  gridMeta: { fontFamily: fonts.sansMd, fontSize: 12, color: colors.dim, marginTop: 2 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 34 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 18, color: '#FFFFFF' },
  emptyBody: { fontFamily: fonts.sans, fontSize: 14, color: colors.dim, textAlign: 'center' },
  clear: { fontFamily: fonts.sansBold, fontSize: 14, color: accent, marginTop: 8 },
});
