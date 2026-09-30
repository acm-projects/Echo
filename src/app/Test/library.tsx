import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { ContinueCard } from '../components/ContinueCard';
import { BookCard } from '../components/BookCard';
import { CastCard } from '../components/CastCard';
import { colors, fonts, type } from '../theme';

const BOOKS = [
  { id: '1', title: 'A Season of Ash', author: 'Mara Vey', progress: 0.15, tint: ['#2F6B3A', '#10281A'] as const },
  { id: '2', title: 'The Bell at Dusk', author: 'I.L. Rowan', progress: 0.6, tint: ['#6B2A2E', '#2A1014'] as const },
  { id: '3', title: 'Salt and Lantern', author: 'Ines Calder', progress: 0, tint: ['#2B4A7A', '#10203C'] as const },
  { id: '4', title: 'Paper Moons', author: 'T. Okafor', progress: 0.9, tint: ['#7A5A2B', '#3C2A10'] as const },
];
const CAST = [
  { id: '1', name: 'Marco Alisdair', role: 'NARRATOR', voice: 'Warm baritone · measured cadence', roleColor: colors.gold },
  { id: '2', name: 'Celia Bowen', role: 'LEAD', voice: 'Clear soprano · quietly powerful', roleColor: colors.pink },
];

export default function Library() {
  const [view, setView] = useState<'books' | 'characters'>('books');
  const [filter, setFilter] = useState('All voices');

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={type.h1}>Library</Text>

        <View style={s.segment}>
          {(['books', 'characters'] as const).map((v) => (
            <Pressable key={v} onPress={() => setView(v)} style={[s.segItem, view === v && s.segActive]}>
              <Text style={[s.segText, view === v && { color: '#2A1258' }]}>{v === 'books' ? 'Books' : 'Characters'}</Text>
            </Pressable>
          ))}
        </View>

        {view === 'books' ? (
          <>
            <Text style={s.section}>Continue listening</Text>
            <ContinueCard title="The Night Circus" chapter="Chapter 7 · The room beneath the stars" timeLeft="24 min" progress={0.36} />

            <View style={s.sectionRow}>
              <Text style={s.section}>From your shelf</Text>
              <Text style={type.meta}>12 volumes</Text>
            </View>
            <View style={s.grid}>
              {BOOKS.map((b) => <BookCard key={b.id} {...b} />)}
            </View>
          </>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {['All voices', 'Featured', 'Ensemble'].map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)} style={[s.chip, filter === f && s.chipActive]}>
                  <Text style={[s.chipText, filter === f && { color: '#2A1258' }]}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={s.sectionRow}>
              <Text style={s.section}>Principal cast</Text>
              <Text style={type.body}>Edit casting</Text>
            </View>
            {CAST.map((c) => <CastCard key={c.id} {...c} />)}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32 },
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 22, padding: 4, marginVertical: 18, borderWidth: 1, borderColor: colors.border },
  segItem: { flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: '#E3C3F5' },
  segText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.dim },
  section: { ...type.h2, fontSize: 18, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  chip: { paddingHorizontal: 18, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  chipActive: { backgroundColor: '#E3C3F5', borderColor: '#E3C3F5' },
  chipText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.dim },
});
