import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { Sheet, SheetItem } from '../../components/Sheet';
import { Reveal } from '../../components/Reveal';
import { DoodleUnderline } from '../../components/Doodle';
import { colors, fonts, type } from '../../../theme';
import { getBook, getBookChapters, getBookCharacters, getBookProgress } from '../../data';
import type { Book, Chapter, Character, UserProgress } from '../../data/types';
import { playback, type QueuedChapter } from '../../data/playback';
import { removeBook, renarrateBook, retryBook } from '../../data/bookJobs';
import { markChaptersSeen, notifyChapterReady } from '../../data/notifications';
import { notify } from '../../../lib/notify';
import { mockBooks } from '../../mock/books';

// Every character gets their own colour, used on their card and wherever they appear, so the cast is easy to tell apart.
const CAST_COLORS = ['#FF9A7A', '#62E6F0', '#FFB45E', '#B79CFF', '#7CF2B8', '#FF6FD0', '#9CC2FF'];
// Covers pick a colour from the title so each book looks like itself.
const COVER_COLORS = [['#7A2E4F', '#F08A6A'], ['#173E5C', '#4FC3D9'], ['#3E2A6B', '#B79CFF'], ['#5A3A14', '#FFB45E'], ['#1F4A3A', '#7CF2B8']] as const;

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// ready: playable (real audio when audioPath is set, otherwise a test book's simulated playback). The others are
// still being narrated, or failed.
type DisplayChapter = { id?: string; number: number; title: string; durationSec: number; state: 'ready' | 'narrating' | 'waiting' | 'failed'; audioPath: string | null };

// While a book is being narrated its chapters are checked this often, so each one becomes playable as it finishes.
const REFRESH_MS = 15000;

function formatLength(sec: number) {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} sec`;
  const minutes = Math.round(sec / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const CHAPTER_NOTE = { ready: '', narrating: 'Being narrated now', waiting: 'Waiting to be narrated', failed: 'Couldn\u2019t be narrated' } as const;

function toDisplay(chapter: Chapter): DisplayChapter {
  const state = chapter.status === 'ready' ? 'ready' : chapter.status === 'failed' ? 'failed' : chapter.status === 'processing' ? 'narrating' : 'waiting';
  return {
    id: chapter.id,
    number: chapter.chapter_index + 1,
    title: chapter.title ?? `Chapter ${chapter.chapter_index + 1}`,
    durationSec: (chapter.audio_duration_ms ?? 0) / 1000,
    state,
    // Test chapters point at mock/ paths with no file behind them; those play the simulated clock.
    audioPath: state === 'ready' && chapter.audio_s3_url && !chapter.audio_s3_url.startsWith('mock/') ? chapter.audio_s3_url : null,
  };
}
type DisplayCharacter = { id: string; name: string; summary: string; voice: string; color: string };

export default function BookDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string; title?: string; author?: string; progress?: string }>();
  const title = params.title ?? 'Book';
  const author = params.author ?? 'Unknown author';
  const parsed = Number(params.progress ?? 0);
  const progress = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
  const cover = COVER_COLORS[hash(title) % COVER_COLORS.length];

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [cast, setCast] = useState<Character[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [menu, setMenu] = useState(false);
  const [person, setPerson] = useState<DisplayCharacter | null>(null);
  const [record, setRecord] = useState<UserProgress | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!params.id) return;
    const id = params.id;
    getBook(id).then(setBook, () => {});
    getBookProgress(id).then(setRecord, () => {});
    getBookCharacters(id).then(setCast, () => {});
    getBookChapters(id).then((next) => {
      setChapters((previous) => {
        // Chapters that finish while the reader watches are announced; ones ready on first look are not.
        if (!previous.length) markChaptersSeen(id, next.filter((c) => c.status === 'ready').map((c) => c.chapter_index));
        for (const chapter of next) {
          const before = previous.find((c) => c.chapter_index === chapter.chapter_index);
          if (previous.length && chapter.status === 'ready' && before?.status !== 'ready') void notifyChapterReady(id, chapter.chapter_index, title, chapter.title ?? `Chapter ${chapter.chapter_index + 1}`);
        }
        return next;
      });
    }, () => {});
  }, [params.id, title]);
  useEffect(load, [load]);

  const preparing = book !== null && ['uploaded', 'queued', 'processing'].includes(book.status);
  const stillNarrating = preparing || chapters.some((c) => c.status === 'queued' || c.status === 'processing');
  useEffect(() => {
    if (!stillNarrating) return;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [stillNarrating, load]);

  // A book opened without chapter rows (from the player, or a test book without any) still gets a list to browse;
  // a book that's being prepared shows none until Echo has found its chapters.
  const chapterList = useMemo<DisplayChapter[]>(
    () =>
      chapters.length
        ? chapters.map(toDisplay)
        : preparing
          ? []
          : Array.from({ length: 12 }, (_, i) => ({ number: i + 1, title: `Chapter ${i + 1}`, durationSec: (16 + ((i * 7) % 11)) * 60, state: 'ready' as const, audioPath: null })),
    [chapters, preparing]
  );
  const single = chapterList.length === 1;
  const ready = chapterList.filter((c) => c.state === 'ready');
  const failedCount = chapterList.filter((c) => c.state === 'failed').length;
  // A real book's saved place says which chapter the reader is on; test books estimate it from their progress.
  const saved = record?.chapter_id ? chapterList.find((c) => c.id === record.chapter_id) : undefined;
  const byProgress = saved ?? chapterList[Math.min(chapterList.length - 1, Math.floor((progress / 100) * chapterList.length))];
  // Where Continue picks up: the chapter the listener is on, or the first one that's ready while the rest are made.
  const current = byProgress?.state === 'ready' ? byProgress : ready[0];
  const resumeAtSec = saved && current === saved && !record?.is_completed ? (record?.position_ms ?? 0) / 1000 : 0;
  // Remove, retry and re-narrate work on books the reader made; the sample books have no server copy.
  const ownBook = Boolean(book && !mockBooks.some((b) => b.id === book.id));

  // Books made with Character Voices off are read entirely by the narrator.
  const narratorOnly = (book?.model_info as { characterVoices?: string } | null)?.characterVoices === 'off';
  const people = useMemo<DisplayCharacter[]>(
    () =>
      cast.filter((c) => !c.is_narrator).map((c, i) => ({
        id: c.id,
        name: c.name,
        summary: c.summary ?? 'More about them as the story unfolds.',
        voice: narratorOnly ? 'Read by your narrator' : c.voice_description ?? c.voice_name ?? 'Voice assigned when the book is narrated',
        color: CAST_COLORS[i % CAST_COLORS.length],
      })),
    [cast, narratorOnly]
  );

  const play = (chapter: DisplayChapter | undefined, startAtSec = 0) => {
    if (!chapter || chapter.state !== 'ready') return;
    const queue: QueuedChapter[] = ready.flatMap((c) => (c.audioPath ? [{ chapter: c.title, chapterNumber: c.number, chapterId: c.id, audioPath: c.audioPath, durationSec: c.durationSec }] : []));
    void playback.load({ title, author, bookId: params.id, chapterId: chapter.id, chapter: chapter.title, chapterNumber: chapter.number, audioPath: chapter.audioPath ?? undefined, durationSec: chapter.durationSec, startAtSec, queue });
    router.push('/Test/player');
  };

  // Retry, re-narrate and remove run on the voice server; the screen refreshes to show the new chapter states.
  const act = async (label: string, action: () => Promise<unknown>, after?: () => void) => {
    setMenu(false);
    setConfirmRemove(false);
    setBusy(true);
    try {
      await action();
      after ? after() : load();
    } catch (error) {
      notify(label, error instanceof Error ? error.message : 'The voice server didn\u2019t respond.');
    } finally {
      setBusy(false);
    }
  };

  const toggleChapters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAll(!showAll);
  };

  const start = current ? current.number - 1 : 0;
  const visible = showAll || chapterList.length <= 4 ? chapterList : chapterList.slice(start, start + 4);
  const narratingNow = chapterList.find((c) => c.state === 'narrating');

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
            <Text style={type.meta}>{!current ? 'BEING NARRATED' : single ? 'FULL AUDIOBOOK' : `YOU'RE ON CHAPTER ${current.number}`}</Text>
            <Text style={[s.percent, { color: cover[1] }]}>{Math.round(progress)}%</Text>
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${progress}%`, backgroundColor: cover[1] }]} /></View>
          <Pressable style={[s.continue, { backgroundColor: cover[1] }, !current && s.disabled]} onPress={() => play(current, resumeAtSec)} disabled={!current} accessibilityRole="button">
            <Ionicons name={current ? 'play' : 'hourglass-outline'} size={18} color="#18131E" />
            <Text style={s.continueText}>{!current ? 'Narrating the first chapter\u2026' : progress > 0 ? 'Continue listening' : 'Start listening'}</Text>
          </Pressable>
          {failedCount > 0 && !stillNarrating && params.id && (
            <Pressable style={s.retry} onPress={() => act('Couldn\u2019t retry', () => retryBook(params.id!))} disabled={busy} accessibilityRole="button">
              <Ionicons name="refresh" size={16} color={colors.text} />
              <Text style={s.retryText}>{busy ? 'Starting\u2026' : `Retry ${failedCount === 1 ? 'the failed chapter' : `${failedCount} failed chapters`}`}</Text>
            </Pressable>
          )}
          {stillNarrating && current && (
            <Text style={type.meta}>{ready.length} of {chapterList.length} chapters ready{narratingNow ? ` \u00b7 narrating ${narratingNow.title}` : ''}. New chapters appear here as they finish.</Text>
          )}
        </Reveal>

        <Reveal index={2} style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{single ? 'Audiobook' : 'Chapters'}</Text>
            {chapterList.length > 4 && (
              <Pressable onPress={toggleChapters} hitSlop={8} accessibilityRole="button">
                <Text style={[s.seeAll, { color: cover[1] }]}>{showAll ? 'Show less' : `All ${chapterList.length}`}</Text>
              </Pressable>
            )}
          </View>
          {chapterList.length === 0 ? (
            <Text style={type.body}>Echo is reading the book and finding its chapters. They appear here as soon as narration starts.</Text>
          ) : (
            <View style={s.chapterCard}>
              {visible.map((chapter, i) => {
                const isCurrent = chapter.number === current?.number;
                const playable = chapter.state === 'ready';
                const detail = playable ? `${formatLength(chapter.durationSec)}${isCurrent && !single ? ' \u00b7 up next' : ''}` : CHAPTER_NOTE[chapter.state];
                return (
                  <Pressable key={chapter.number} style={[s.chapterRow, i === visible.length - 1 && { borderBottomWidth: 0 }]} onPress={() => play(chapter)} disabled={!playable} accessibilityRole="button" accessibilityState={{ disabled: !playable }} accessibilityLabel={playable ? `Play ${chapter.title}` : `${chapter.title}, ${detail}`}>
                    <View style={[s.chapterNumber, isCurrent && { backgroundColor: cover[1], borderColor: cover[1] }]}>
                      {isCurrent ? <Ionicons name="play" size={12} color="#18131E" /> : <Text style={s.chapterNumberText}>{chapter.number}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.chapterName, !playable && { color: colors.dim }]}>{chapter.title}</Text>
                      <Text style={[type.meta, chapter.state === 'failed' && { color: colors.danger }]}>{detail}</Text>
                    </View>
                    <Ionicons
                      name={playable ? 'play-circle-outline' : chapter.state === 'failed' ? 'alert-circle-outline' : chapter.state === 'narrating' ? 'mic-outline' : 'time-outline'}
                      size={22}
                      color="rgba(255,255,255,0.4)"
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </Reveal>

        <Reveal index={3} style={s.section}>
          <View style={s.sectionHead}>
            <View>
              <Text style={s.sectionTitle}>The cast</Text>
              <DoodleUnderline width={96} color={cover[1]} seed={title} delay={600} />
              <Text style={type.meta}>{narratorOnly ? 'Your narrator reads every part' : 'Each one has a voice of their own'}</Text>
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
        <SheetItem icon="play-skip-back-outline" label="Play from the beginning" onPress={() => { setMenu(false); play(ready[0]); }} />
        <SheetItem icon="mic-outline" label="Change narrator" detail="Pick who reads your books" onPress={() => { setMenu(false); router.push('/narrator-voices'); }} />
        {ownBook && params.id && !stillNarrating && (
          <SheetItem icon="sync-outline" label="Re-narrate with my narrator" detail="Reads every chapter again" onPress={() => act('Couldn\u2019t re-narrate', () => renarrateBook(params.id!))} />
        )}
        <SheetItem icon="share-outline" label="Share" onPress={() => { setMenu(false); Share.share({ message: `I'm listening to ${title} by ${author} on Echo.` }).catch(() => {}); }} />
        <SheetItem icon="trash-outline" label="Remove from library" danger onPress={() => { setMenu(false); ownBook ? setConfirmRemove(true) : notify('Test book', 'Sample books can\u2019t be removed.'); }} />
      </Sheet>

      <Sheet visible={confirmRemove} onClose={() => setConfirmRemove(false)} title={`Remove ${title}?`}>
        <Text style={[type.body, { marginBottom: 8 }]}>Its audio and chapters are deleted for good. Narration that's still running stops.</Text>
        <SheetItem icon="trash-outline" label="Remove for good" danger onPress={() => params.id && act('Couldn\u2019t remove the book', () => removeBook(params.id!), () => (router.canGoBack() ? router.back() : router.replace('/Test/library')))} />
        <SheetItem icon="close-outline" label="Keep it" onPress={() => setConfirmRemove(false)} />
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
  disabled: { opacity: 0.55 },
  retry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  retryText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.text },
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
