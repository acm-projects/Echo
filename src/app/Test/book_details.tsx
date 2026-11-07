import { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { Sheet, SheetItem } from '../../components/Sheet';
import { Reveal } from '../../components/Reveal';
import { DoodleUnderline } from '../../components/Doodle';
import { colors, fonts, type } from '../../../theme';
import { getBookChapters, getBookCharacters } from '../../data';
import type { Chapter, Character } from '../../data/types';
import { playback } from '../../data/playback';
import { notify } from '../../../lib/notify';

// Every character gets their own colour, used on their card and wherever they appear, so the cast is easy to tell apart.
const CAST_COLORS = ['#FF9A7A', '#62E6F0', '#FFB45E', '#B79CFF', '#7CF2B8', '#FF6FD0', '#9CC2FF'];
// Covers pick a colour from the title so each book looks like itself.
const COVER_COLORS = [['#7A2E4F', '#F08A6A'], ['#173E5C', '#4FC3D9'], ['#3E2A6B', '#B79CFF'], ['#5A3A14', '#FFB45E'], ['#1F4A3A', '#7CF2B8']] as const;

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

type DisplayChapter = { number: number; title: string; minutes: number };
type DisplayCharacter = { id: string; name: string; summary: string; voice: string; color: string };

export default function BookDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string; title?: string; author?: string; progress?: string }>();
  const title = params.title ?? 'Book';
  const author = params.author ?? 'Unknown author';
  const parsed = Number(params.progress ?? 0);
  const progress = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
  const cover = COVER_COLORS[hash(title) % COVER_COLORS.length];

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [cast, setCast] = useState<Character[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [menu, setMenu] = useState(false);
  const [person, setPerson] = useState<DisplayCharacter | null>(null);

  useEffect(() => {
    if (!params.id) return;
    getBookChapters(params.id).then(setChapters, () => {});
    getBookCharacters(params.id).then(setCast, () => {});
  }, [params.id]);

  // Books without processed chapters yet still get a sensible list to browse.
  const chapterList = useMemo<DisplayChapter[]>(
    () =>
      chapters.length
        ? chapters.map((c) => ({ number: c.chapter_index + 1, title: c.title ?? `Chapter ${c.chapter_index + 1}`, minutes: Math.max(1, Math.round((c.audio_duration_ms ?? 18 * 60000) / 60000)) }))
        : Array.from({ length: 12 }, (_, i) => ({ number: i + 1, title: `Chapter ${i + 1}`, minutes: 16 + ((i * 7) % 11) })),
    [chapters]
  );
  const current = chapterList[Math.min(chapterList.length - 1, Math.floor((progress / 100) * chapterList.length))];

  const people = useMemo<DisplayCharacter[]>(
    () =>
      cast.filter((c) => !c.is_narrator).map((c, i) => ({
        id: c.id,
        name: c.name,
        summary: c.summary ?? 'More about them as the story unfolds.',
        voice: c.voice_description ?? c.voice_name ?? 'Voice assigned when the book is narrated',
        color: CAST_COLORS[i % CAST_COLORS.length],
      })),
    [cast]
  );

  const play = (chapter: DisplayChapter) => {
    playback.load({ title, author, chapter: chapter.title, chapterNumber: chapter.number });
    router.push('/Test/player');
  };

  const toggleChapters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAll(!showAll);
  };

  const visible = showAll ? chapterList : chapterList.slice(Math.max(0, current.number - 1), current.number + 3);

  return (
    <Screen interior="bookshop">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.page}>
        <View style={s.topBar}>
          <Pressable style={s.iconButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/Test/library'))} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Pressable style={s.iconButton} onPress={() => setMenu(true)} accessibilityLabel="More options">
            <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
          </Pressable>
        </View>

        <Reveal style={s.header}>
          <View style={[s.cover, { backgroundColor: cover[0] }]}>
            <View style={[s.coverSpine, { backgroundColor: cover[1] }]} />
            <Text style={s.coverTitle} numberOfLines={3}>{title}</Text>
            <View style={[s.coverBand, { backgroundColor: cover[1] }]} />
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.author}>{author}</Text>
        </Reveal>

        <Reveal index={1} style={s.progressCard}>
          <View style={s.progressLabels}>
            <Text style={type.meta}>YOU'RE ON CHAPTER {current.number}</Text>
            <Text style={[s.percent, { color: cover[1] }]}>{Math.round(progress)}%</Text>
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${progress}%`, backgroundColor: cover[1] }]} /></View>
          <Pressable style={[s.continue, { backgroundColor: cover[1] }]} onPress={() => play(current)} accessibilityRole="button">
            <Ionicons name="play" size={18} color="#18131E" />
            <Text style={s.continueText}>{progress > 0 ? 'Continue listening' : 'Start listening'}</Text>
          </Pressable>
        </Reveal>

        <Reveal index={2} style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Chapters</Text>
            <Pressable onPress={toggleChapters} hitSlop={8} accessibilityRole="button">
              <Text style={[s.seeAll, { color: cover[1] }]}>{showAll ? 'Show less' : `All ${chapterList.length}`}</Text>
            </Pressable>
          </View>
          <View style={s.chapterCard}>
            {visible.map((chapter, i) => {
              const isCurrent = chapter.number === current.number;
              return (
                <Pressable key={chapter.number} style={[s.chapterRow, i === visible.length - 1 && { borderBottomWidth: 0 }]} onPress={() => play(chapter)} accessibilityRole="button" accessibilityLabel={`Play ${chapter.title}`}>
                  <View style={[s.chapterNumber, isCurrent && { backgroundColor: cover[1], borderColor: cover[1] }]}>
                    {isCurrent ? <Ionicons name="play" size={12} color="#18131E" /> : <Text style={s.chapterNumberText}>{chapter.number}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.chapterName}>{chapter.title}</Text>
                    <Text style={type.meta}>{chapter.minutes} min{isCurrent ? ' · up next' : ''}</Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={22} color="rgba(255,255,255,0.4)" />
                </Pressable>
              );
            })}
          </View>
        </Reveal>

        <Reveal index={3} style={s.section}>
          <View style={s.sectionHead}>
            <View>
              <Text style={s.sectionTitle}>The cast</Text>
              <DoodleUnderline width={96} color={cover[1]} seed={title} delay={600} />
              <Text style={type.meta}>Each one has a voice of their own</Text>
            </View>
          </View>
          {people.length === 0 ? (
            <Text style={[type.body, { marginTop: 4 }]}>Characters appear here once Echo has read the book.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
              {people.map((p) => (
                <Pressable key={p.id} style={[s.castCard, { borderColor: `${p.color}55` }]} onPress={() => setPerson(p)} accessibilityRole="button">
                  <View style={[s.castAvatar, { backgroundColor: `${p.color}33` }]}>
                    <Text style={[s.castInitial, { color: p.color }]}>{p.name.charAt(0)}</Text>
                  </View>
                  <Text style={s.castName} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.castVoice} numberOfLines={2}>{p.voice}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Reveal>
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={title}>
        <SheetItem icon="play-skip-back-outline" label="Play from the beginning" onPress={() => { setMenu(false); play(chapterList[0]); }} />
        <SheetItem icon="mic-outline" label="Change narrator" onPress={() => { setMenu(false); router.push('/narrator-voices'); }} />
        <SheetItem icon="share-outline" label="Share" onPress={() => { setMenu(false); Share.share({ message: `I'm listening to ${title} by ${author} on Echo.` }).catch(() => {}); }} />
        <SheetItem icon="trash-outline" label="Remove from library" danger onPress={() => { setMenu(false); notify('Not yet', 'Removing books arrives with the library database.'); }} />
      </Sheet>

      <Sheet visible={person !== null} onClose={() => setPerson(null)}>
        {person && (
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[s.castAvatar, { width: 56, height: 56, borderRadius: 28, backgroundColor: `${person.color}33` }]}>
                <Text style={[s.castInitial, { color: person.color, fontSize: 24 }]}>{person.name.charAt(0)}</Text>
              </View>
              <Text style={s.sheetName}>{person.name}</Text>
            </View>
            <Text style={[type.body, { lineHeight: 21 }]}>{person.summary}</Text>
            <View style={[s.voiceBox, { borderColor: `${person.color}55` }]}>
              <Ionicons name="mic-outline" size={16} color={person.color} />
              <Text style={[type.body, { flex: 1, color: colors.text }]}>{person.voice}</Text>
            </View>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 200 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginTop: 8 },
  cover: { width: 168, height: 236, borderRadius: 14, padding: 16, justifyContent: 'flex-end', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
  coverSpine: { position: 'absolute', left: 12, top: 0, bottom: 0, width: 3 },
  coverBand: { width: 40, height: 3, marginTop: 12 },
  coverTitle: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 24, color: '#fff' },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.text, textAlign: 'center', marginTop: 20 },
  author: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.dim, marginTop: 4 },
  progressCard: { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 10 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  percent: { fontFamily: fonts.sansBold, fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  continue: { marginTop: 4, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#18131E' },
  section: { marginTop: 30 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.text },
  seeAll: { fontFamily: fonts.sansBold, fontSize: 14 },
  chapterCard: { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  chapterNumber: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chapterNumberText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.dim },
  chapterName: { fontFamily: fonts.sansMd, fontSize: 15, color: colors.text },
  castCard: { width: 140, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, gap: 6 },
  castAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  castInitial: { fontFamily: fonts.serif, fontSize: 20 },
  castName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text },
  castVoice: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.dim },
  sheetName: { fontFamily: fonts.serif, fontSize: 26, color: colors.text },
  voiceBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
});
