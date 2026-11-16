
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { BookCover } from '../../components/BookCover';
import { Sheet, SheetItem } from '../../components/Sheet';
import { CastSheet } from '../../components/CastSheet';
import { Reveal } from '../../components/Reveal';
import { DoodleUnderline } from '../../components/Doodle';
import { colors, fonts, type } from '../../../theme';
import { getBook, getBookChapters, getBookCharacters, getBookProgress } from '../../data';
import type { Book, Chapter, Character, UserProgress } from '../../data/types';
import { playback, type QueuedChapter } from '../../data/playback';
import { getBookJob, removeBook, renarrateBook, retryBook, stopBook } from '../../data/bookJobs';
import { uploadBookCover, restoreBookCover } from '../../data/bookCovers';
import { getBookCast, type CastMember } from '../../data/narrators';
import { markChaptersSeen, notifyChapterReady } from '../../data/notifications';
import { confirm, notify } from '../../../lib/notify';
import { mockBooks } from '../../mock/books';

const CAST_COLORS = ['#FF9A7A', '#62E6F0', '#FFB45E', '#B79CFF', '#7CF2B8', '#FF6FD0', '#9CC2FF'];
const COVER_COLORS = [['#7A2E4F', '#F08A6A'], ['#173E5C', '#4FC3D9'], ['#3E2A6B', '#B79CFF'], ['#5A3A14', '#FFB45E'], ['#1F4A3A', '#7CF2B8']] as const;

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

type DisplayChapter = {
  id?: string;
  number: number;
  title: string;
  durationSec: number;
  state: 'ready' | 'narrating' | 'waiting' | 'failed';
  audioPath: string | null;
};

const REFRESH_MS = 15000;

function formatLength(sec: number) {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} sec`;
  const minutes = Math.round(sec / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const CHAPTER_NOTE = {
  ready: '',
  narrating: 'Being narrated now',
  waiting: 'Waiting to be narrated',
  failed: 'Couldn’t be narrated'
} as const;

function toDisplay(chapter: Chapter): DisplayChapter {
  const state = chapter.status === 'ready'
    ? 'ready'
    : chapter.status === 'failed'
      ? 'failed'
      : chapter.status === 'processing'
        ? 'narrating'
        : 'waiting';

  return {
    id: chapter.id,
    number: chapter.chapter_index + 1,
    title: chapter.title ?? `Chapter ${chapter.chapter_index + 1}`,
    durationSec: (chapter.audio_duration_ms ?? 0) / 1000,
    state,
    audioPath: state === 'ready' && chapter.audio_s3_url && !chapter.audio_s3_url.startsWith('mock/')
      ? chapter.audio_s3_url
      : null,
  };
}

type DisplayCharacter = {
  id: string;
  name: string;
  summary: string;
  voice: string;
  color: string;
};

export default function BookDetailsScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    author?: string;
    progress?: string;
  }>();

  const title = params.title ?? 'Book';
  const author = params.author ?? 'Unknown author';
  const parsed = Number(params.progress ?? 0);
  const progress = Number.isFinite(parsed)
    ? Math.min(100, Math.max(0, parsed))
    : 0;
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
  const [coverBusy, setCoverBusy] = useState(false);
  const [stopping, setStopping] = useState(false);

  const [castSheet, setCastSheet] = useState<{
    mode: 'review' | 'edit';
    cast: CastMember[];
  } | null>(null);

  const [awaitingCast, setAwaitingCast] = useState<CastMember[] | null>(null);
  const reopenCast = useRef(false);

  const load = useCallback(() => {
    if (!params.id) return;

    const id = params.id;

    getBook(id).then((next) => {
      setBook(next);

      if (next && ['uploaded', 'queued', 'processing'].includes(next.status)) {
        getBookJob(id).then(
          (job) => setAwaitingCast(job.awaitingCast ? job.cast ?? [] : null),
          () => setAwaitingCast(null)
        );
      } else {
        setAwaitingCast(null);
      }
    }, () => {});

    getBookProgress(id).then(setRecord, () => {});
    getBookCharacters(id).then(setCast, () => {});

    getBookChapters(id).then((next) => {
      setChapters((previous) => {
        if (!previous.length) {
          markChaptersSeen(
            id,
            next.filter((c) => c.status === 'ready').map((c) => c.chapter_index)
          );
        }

        for (const chapter of next) {
          const before = previous.find(
            (c) => c.chapter_index === chapter.chapter_index
          );

          if (
            previous.length &&
            chapter.status === 'ready' &&
            before?.status !== 'ready'
          ) {
            void notifyChapterReady(
              id,
              chapter.chapter_index,
              title,
              chapter.title ?? `Chapter ${chapter.chapter_index + 1}`
            );
          }
        }

        return next;
      });
    }, () => {});
  }, [params.id, title]);

  useEffect(load, [load]);

  useFocusEffect(useCallback(() => {
    if (!reopenCast.current) return;

    reopenCast.current = false;
    load();

    if (awaitingCast) {
      setCastSheet({ mode: 'review', cast: awaitingCast });
    } else if (params.id) {
      getBookCast(params.id)
        .then((result) => setCastSheet({ mode: 'edit', cast: result.cast }))
        .catch(() => {});
    }
  }, [awaitingCast, load, params.id]));

  const openStudio = () => {
    reopenCast.current = true;
    setCastSheet(null);
    router.push('/voice-studio');
  };

  const changeVoices = () => act('Couldn’t open the cast', async () => {
    const result = await getBookCast(params.id!);
    setCastSheet({
      mode: result.awaitingCast ? 'review' : 'edit',
      cast: result.cast,
    });
  }, () => {});

  const preview = !params.id || params.id.startsWith('discover-');
  const isSample = mockBooks.some((b) => b.id === params.id);
  const preparing = book !== null &&
    ['uploaded', 'queued', 'processing'].includes(book.status);

  const stillNarrating = preparing ||
    chapters.some((c) => c.status === 'queued' || c.status === 'processing');

  useEffect(() => {
    if (!stillNarrating) return;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [stillNarrating, load]);

  const chapterList = useMemo<DisplayChapter[]>(
    () =>
      chapters.length
        ? chapters.map(toDisplay)
        : preparing || !isSample
          ? []
          : Array.from({ length: 12 }, (_, i) => ({
              number: i + 1,
              title: `Chapter ${i + 1}`,
              durationSec: (16 + ((i * 7) % 11)) * 60,
              state: 'ready' as const,
              audioPath: null,
            })),
    [chapters, isSample, preparing]
  );

  const single = chapterList.length === 1;
  const ready = chapterList.filter((c) => c.state === 'ready');
  const failedCount = chapterList.filter((c) => c.state === 'failed').length;

  const saved = record?.chapter_id
    ? chapterList.find((c) => c.id === record.chapter_id)
    : undefined;

  const byProgress = saved ?? chapterList[
    Math.min(
      chapterList.length - 1,
      Math.floor((progress / 100) * chapterList.length)
    )
  ];

  const current = byProgress?.state === 'ready' ? byProgress : ready[0];

  const resumeAtSec = saved && current === saved && !record?.is_completed
    ? (record?.position_ms ?? 0) / 1000
    : 0;

  const ownBook = Boolean(
    book && !mockBooks.some((b) => b.id === book.id)
  );

  const narratorOnly =
    (book?.model_info as { characterVoices?: string } | null)
      ?.characterVoices === 'off';

  const people = useMemo<DisplayCharacter[]>(
    () =>
      cast.filter((c) => !c.is_narrator).map((c, i) => ({
        id: c.id,
        name: c.name,
        summary: c.summary ?? 'More about them as the story unfolds.',
        voice: narratorOnly
          ? 'Read by your narrator'
          : c.voice_description ??
            c.voice_name ??
            'Voice assigned when the book is narrated',
        color: CAST_COLORS[i % CAST_COLORS.length],
      })),
    [cast, narratorOnly]
  );

  const play = (chapter: DisplayChapter | undefined, startAtSec = 0) => {
    if (!chapter || chapter.state !== 'ready') return;

    const queue: QueuedChapter[] = ready.flatMap((c) =>
      c.audioPath
        ? [{
            chapter: c.title,
            chapterNumber: c.number,
            chapterId: c.id,
            audioPath: c.audioPath,
            durationSec: c.durationSec,
          }]
        : []
    );

    void playback.load({
      title,
      author,
      bookId: params.id,
      chapterId: chapter.id,
      chapter: chapter.title,
      chapterNumber: chapter.number,
      audioPath: chapter.audioPath ?? undefined,
      durationSec: chapter.durationSec,
      startAtSec,
      queue,
    });

    router.push('/Test/player');
  };

  const act = async (
    label: string,
    action: () => Promise<unknown>,
    after?: () => void
  ) => {
    setMenu(false);
    setConfirmRemove(false);
    setBusy(true);

    try {
      await action();
      after ? after() : load();
    } catch (error) {
      notify(
        label,
        error instanceof Error
          ? error.message
          : 'The voice server didn’t respond.'
      );
    } finally {
      setBusy(false);
    }
  };

  const changeCover = async () => {
    console.log('CHANGE COVER FUNCTION STARTED');

    if (!params.id || coverBusy) {
      console.log('CHANGE COVER BLOCKED', {
        id: params.id,
        coverBusy,
      });
      return;
    }

    setMenu(false);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      console.log('MEDIA PERMISSION', permission);

      if (!permission.granted) {
        notify(
          'Photos access needed',
          'Please allow photo library access to choose a cover.'
        );
        return;
      }

      // Let the menu fully close before opening the picker
      await new Promise((resolve) => setTimeout(resolve, 300));

      console.log('OPENING PHOTO PICKER');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [5, 7],
        quality: 0.85,
      });

      console.log('PHOTO PICKER RESULT', result);

      if (result.canceled || !result.assets.length) return;

      setCoverBusy(true);

      const coverPath = await uploadBookCover(
        params.id,
        result.assets[0]
      );

      setBook((previous) =>
        previous
          ? { ...previous, cover_image_path: coverPath }
          : previous
      );
    } catch (error) {
      console.log('CHANGE COVER ERROR', error);

      notify(
        'Could not change cover',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setCoverBusy(false);
    }
  };

  const restoreCover = async () => {
    setMenu(false);
    if (!params.id || coverBusy) return;

    setCoverBusy(true);

    try {
      const coverPath = await restoreBookCover(params.id);

      setBook((previous) =>
        previous
          ? { ...previous, cover_image_path: coverPath }
          : previous
      );
    } catch (error) {
      notify(
        'Could not restore cover',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setCoverBusy(false);
    }
  };

  const stopNarration = async () => {
    setMenu(false);
    if (!params.id || stopping) return;

    if (!(await confirm(
      'Stop narrating?',
      'The audio made so far is deleted and you go back to Meet the cast. The voices are kept, and you can start again or delete the book.',
      'Stop'
    ))) return;

    setStopping(true);

    try {
      const result = await stopBook(params.id);

      if (result.awaitingCast) {
        setAwaitingCast(result.cast);
        setCastSheet({ mode: 'review', cast: result.cast });
      } else {
        notify(
          'Stopping after the voices',
          'Echo is still making the cast’s voices. Meet the cast appears here when they’re ready, and narration won’t start until you approve it.'
        );
      }

      load();
    } catch (error) {
      notify(
        'Couldn’t stop narration',
        error instanceof Error
          ? error.message
          : 'The voice server didn’t respond.'
      );
    } finally {
      setStopping(false);
    }
  };

  const deleteFromCast = async () => {
    await removeBook(params.id!);
    setCastSheet(null);

    router.canGoBack()
      ? router.back()
      : router.replace('/Test/library');
  };

  const toggleChapters = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.Presets.easeInEaseOut
    );
    setShowAll(!showAll);
  };

  const start = current ? current.number - 1 : 0;

  const visible = showAll || chapterList.length <= 4
    ? chapterList
    : chapterList.slice(start, start + 4);

  const narratingNow = chapterList.find(
    (c) => c.state === 'narrating'
  );

  return (
    <Screen interior="bookshop">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.page}
      >
        <View style={s.topBar}>
          <Pressable
            style={s.iconButton}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/Test/library')
            }
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color="#fff"
            />
          </Pressable>

          <Pressable
            style={s.iconButton}
            onPress={() => setMenu(true)}
            accessibilityLabel="More options"
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color="#fff"
            />
          </Pressable>
        </View>

        <Reveal style={s.header}>
          {book?.cover_image_path ? (
            <BookCover
              title={title}
              author={author}
              accent={cover[0]}
              width={168}
              coverPath={book.cover_image_path}
              style={s.coverImage}
            />
          ) : (
            <View
              style={[
                s.cover,
                { backgroundColor: cover[0] }
              ]}
            >
              <View
                style={[
                  s.coverSpine,
                  { backgroundColor: cover[1] }
                ]}
              />
              <Text
                style={s.coverTitle}
                numberOfLines={3}
              >
                {title}
              </Text>
              <View
                style={[
                  s.coverBand,
                  { backgroundColor: cover[1] }
                ]}
              />
            </View>
          )}

          <Text style={s.title}>{title}</Text>
          <Text style={s.author}>{author}</Text>
        </Reveal>

        <Reveal index={1} style={s.progressCard}>
          <View style={s.progressLabels}>
            <Text style={type.meta}>
              {preview
                ? 'NOT IN YOUR LIBRARY YET'
                : !current
                  ? 'BEING NARRATED'
                  : single
                    ? 'FULL AUDIOBOOK'
                    : `YOU'RE ON CHAPTER ${current.number}`}
            </Text>
            <Text
              style={[
                s.percent,
                { color: cover[1] }
              ]}
            >
              {Math.round(progress)}%
            </Text>
          </View>

          <View style={s.track}>
            <View
              style={[
                s.fill,
                {
                  width: `${progress}%`,
                  backgroundColor: cover[1],
                }
              ]}
            />
          </View>

          {preview ? (
            <>
              <Pressable
                style={[
                  s.continue,
                  { backgroundColor: cover[1] }
                ]}
                onPress={() => router.push('/Test/catalog')}
                accessibilityRole="button"
              >
                <Ionicons
                  name="add"
                  size={18}
                  color="#18131E"
                />
                <Text style={s.continueText}>
                  Add it from Public Domain
                </Text>
              </Pressable>

              <Text style={type.meta}>
                Echo narrates it once it’s on your shelf,
                with a voice for every character.
              </Text>
            </>
          ) : awaitingCast ? (
            <>
              <Pressable
                style={[
                  s.continue,
                  { backgroundColor: colors.gold }
                ]}
                onPress={() =>
                  setCastSheet({
                    mode: 'review',
                    cast: awaitingCast,
                  })
                }
                accessibilityRole="button"
              >
                <Ionicons
                  name="people"
                  size={18}
                  color="#18131E"
                />
                <Text style={s.continueText}>
                  Meet the cast
                </Text>
              </Pressable>

              <Text style={type.meta}>
                The voices are ready. Narration starts
                once you’ve approved the cast.
              </Text>
            </>
          ) : (
            <Pressable
              style={[
                s.continue,
                { backgroundColor: cover[1] },
                !current && s.disabled
              ]}
              onPress={() =>
                play(current, resumeAtSec)
              }
              disabled={!current}
              accessibilityRole="button"
            >
              <Ionicons
                name={current ? 'play' : 'hourglass-outline'}
                size={18}
                color="#18131E"
              />
              <Text style={s.continueText}>
                {!current
                  ? 'Narrating the first chapter…'
                  : progress > 0
                    ? 'Continue listening'
                    : 'Start listening'}
              </Text>
            </Pressable>
          )}

          {failedCount > 0 &&
            !stillNarrating &&
            params.id && (
              <Pressable
                style={s.retry}
                onPress={() =>
                  act(
                    'Couldn’t retry',
                    () => retryBook(params.id!)
                  )
                }
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={colors.text}
                />
                <Text style={s.retryText}>
                  {busy
                    ? 'Starting…'
                    : `Retry ${
                        failedCount === 1
                          ? 'the failed chapter'
                          : `${failedCount} failed chapters`
                      }`}
                </Text>
              </Pressable>
            )}

          {stillNarrating &&
            !awaitingCast &&
            current && (
              <Text style={type.meta}>
                {ready.length} of {chapterList.length} chapters ready
                {narratingNow
                  ? ` · narrating ${narratingNow.title}`
                  : ''}. New chapters appear here as they finish.
              </Text>
            )}

          {stillNarrating &&
            !awaitingCast &&
            ownBook &&
            params.id && (
              <Pressable
                style={s.retry}
                onPress={stopNarration}
                disabled={stopping}
                accessibilityRole="button"
              >
                <Ionicons
                  name="stop-circle-outline"
                  size={16}
                  color={colors.danger}
                />
                <Text
                  style={[
                    s.retryText,
                    { color: colors.danger }
                  ]}
                >
                  {stopping
                    ? 'Stopping at the end of this line…'
                    : 'Stop narration'}
                </Text>
              </Pressable>
            )}
        </Reveal>

        <Reveal index={2} style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>
              {single ? 'Audiobook' : 'Chapters'}
            </Text>

            {chapterList.length > 4 && (
              <Pressable
                onPress={toggleChapters}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    s.seeAll,
                    { color: cover[1] }
                  ]}
                >
                  {showAll
                    ? 'Show less'
                    : `All ${chapterList.length}`}
                </Text>
              </Pressable>
            )}
          </View>

          {chapterList.length === 0 ? (
            <Text style={type.body}>
              {preview
                ? 'Chapters appear here once the book is on your shelf and narrated.'
                : 'Echo is reading the book and finding its chapters. They appear here as soon as narration starts.'}
            </Text>
          ) : (
            <View style={s.chapterCard}>
              {visible.map((chapter, i) => {
                const isCurrent =
                  chapter.number === current?.number;
                const playable = chapter.state === 'ready';

                const detail = playable
                  ? `${formatLength(chapter.durationSec)}${
                      isCurrent && !single
                        ? ' · up next'
                        : ''
                    }`
                  : CHAPTER_NOTE[chapter.state];

                return (
                  <Pressable
                    key={chapter.number}
                    style={[
                      s.chapterRow,
                      i === visible.length - 1 && {
                        borderBottomWidth: 0,
                      }
                    ]}
                    onPress={() => play(chapter)}
                    disabled={!playable}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: !playable,
                    }}
                    accessibilityLabel={
                      playable
                        ? `Play ${chapter.title}`
                        : `${chapter.title}, ${detail}`
                    }
                  >
                    <View
                      style={[
                        s.chapterNumber,
                        isCurrent && {
                          backgroundColor: cover[1],
                          borderColor: cover[1],
                        }
                      ]}
                    >
                      {isCurrent ? (
                        <Ionicons
                          name="play"
                          size={12}
                          color="#18131E"
                        />
                      ) : (
                        <Text style={s.chapterNumberText}>
                          {chapter.number}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.chapterName,
                          !playable && {
                            color: colors.dim
                          }
                        ]}
                      >
                        {chapter.title}
                      </Text>

                      <Text
                        style={[
                          type.meta,
                          chapter.state === 'failed' && {
                            color: colors.danger
                          }
                        ]}
                      >
                        {detail}
                      </Text>
                    </View>

                    <Ionicons
                      name={
                        playable
                          ? 'play-circle-outline'
                          : chapter.state === 'failed'
                            ? 'alert-circle-outline'
                            : chapter.state === 'narrating'
                              ? 'mic-outline'
                              : 'time-outline'
                      }
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
              <Text style={s.sectionTitle}>
                The cast
              </Text>
              <DoodleUnderline
                width={96}
                color={cover[1]}
                seed={title}
                delay={600}
              />
              <Text style={type.meta}>
                {narratorOnly
                  ? 'Your narrator reads every part'
                  : 'Each one has a voice of their own'}
              </Text>
            </View>
          </View>

          {people.length === 0 ? (
            <Text
              style={[
                type.body,
                { marginTop: 4 }
              ]}
            >
              {preview
                ? 'Echo finds the characters and gives each a voice when it narrates the book.'
                : 'Characters appear here once Echo has read the book.'}
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 12,
                paddingRight: 20
              }}
            >
              {people.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    s.castCard,
                    { borderColor: `${p.color}55` }
                  ]}
                  onPress={() => setPerson(p)}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      s.castAvatar,
                      {
                        backgroundColor: `${p.color}33`
                      }
                    ]}
                  >
                    <Text
                      style={[
                        s.castInitial,
                        { color: p.color }
                      ]}
                    >
                      {p.name.charAt(0)}
                    </Text>
                  </View>

                  <Text
                    style={s.castName}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>

                  <Text
                    style={s.castVoice}
                    numberOfLines={2}
                  >
                    {p.voice}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Reveal>
      </ScrollView>

      <Sheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={title}
      >
        {ownBook && params.id && (
          <>
            <SheetItem
              icon="image-outline"
              label={coverBusy ? 'Saving cover…' : 'Change cover'}
              detail="Choose an image from your gallery"
              onPress={() => {
                console.log('CHANGE COVER PRESSED');
                void changeCover();
              }}
            />

            <SheetItem
              icon="refresh-outline"
              label="Restore original cover"
              detail="Use the first page of your PDF"
              onPress={() => {
                if (!coverBusy) void restoreCover();
              }}
            />
          </>
        )}

        {ready.length > 0 && (
          <SheetItem
            icon="play-skip-back-outline"
            label="Play from the beginning"
            onPress={() => {
              setMenu(false);
              play(ready[0]);
            }}
          />
        )}

        <SheetItem
          icon="mic-outline"
          label="Voice Studio"
          detail="Design or record voices"
          onPress={() => {
            setMenu(false);
            router.push('/voice-studio');
          }}
        />

        {ownBook &&
          params.id &&
          !narratorOnly &&
          (awaitingCast || !stillNarrating) && (
            <SheetItem
              icon="people-outline"
              label={
                awaitingCast
                  ? 'Meet the cast'
                  : 'Change the voices'
              }
              detail={
                awaitingCast
                  ? 'Approve the voices'
                  : 'Any part, any voice'
              }
              onPress={changeVoices}
            />
          )}

        {ownBook &&
          params.id &&
          stillNarrating &&
          !awaitingCast && (
            <SheetItem
              icon="stop-circle-outline"
              label="Stop narration"
              detail="Back to Meet the cast"
              onPress={stopNarration}
            />
          )}

        {ownBook &&
          params.id &&
          !stillNarrating && (
            <SheetItem
              icon="sync-outline"
              label="Re-narrate with my narrator"
              detail="Reads every chapter again"
              onPress={() =>
                act(
                  'Couldn’t re-narrate',
                  () => renarrateBook(params.id!)
                )
              }
            />
          )}

        <SheetItem
          icon="share-outline"
          label="Share"
          onPress={() => {
            setMenu(false);
            Share.share({
              message: `I'm listening to ${title} by ${author} on Echo.`
            }).catch(() => {});
          }}
        />

        {!preview && (
          <SheetItem
            icon="trash-outline"
            label="Remove from library"
            danger
            onPress={() => {
              setMenu(false);

              ownBook
                ? setConfirmRemove(true)
                : notify(
                    'Test book',
                    'Sample books can’t be removed.'
                  );
            }}
          />
        )}
      </Sheet>

      <Sheet
        visible={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove ${title}?`}
      >
        <Text
          style={[
            type.body,
            { marginBottom: 8 }
          ]}
        >
          Its audio and chapters are deleted for good.
          Narration that's still running stops.
        </Text>

        <SheetItem
          icon="trash-outline"
          label="Remove for good"
          danger
          onPress={() =>
            params.id &&
            act(
              'Couldn’t remove the book',
              () => removeBook(params.id!),
              () =>
                router.canGoBack()
                  ? router.back()
                  : router.replace('/Test/library')
            )
          }
        />

        <SheetItem
          icon="close-outline"
          label="Keep it"
          onPress={() => setConfirmRemove(false)}
        />
      </Sheet>

      {params.id && castSheet && (
        <CastSheet
          visible
          bookId={params.id}
          title={title}
          cast={castSheet.cast}
          mode={castSheet.mode}
          onClose={() => setCastSheet(null)}
          onDone={() => {
            setCastSheet(null);
            setAwaitingCast(null);
            load();
          }}
          onOpenStudio={openStudio}
          onDelete={
            castSheet.mode === 'review' && ownBook
              ? deleteFromCast
              : undefined
          }
        />
      )}

      <Sheet
        visible={person !== null}
        onClose={() => setPerson(null)}
      >
        {person && (
          <View
            style={{
              gap: 12,
              paddingBottom: 8
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14
              }}
            >
              <View
                style={[
                  s.castAvatar,
                  {
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: `${person.color}33`
                  }
                ]}
              >
                <Text
                  style={[
                    s.castInitial,
                    {
                      color: person.color,
                      fontSize: 24
                    }
                  ]}
                >
                  {person.name.charAt(0)}
                </Text>
              </View>

              <Text style={s.sheetName}>
                {person.name}
              </Text>
            </View>

            <Text
              style={[
                type.body,
                { lineHeight: 21 }
              ]}
            >
              {person.summary}
            </Text>

            <View
              style={[
                s.voiceBox,
                {
                  borderColor: `${person.color}55`
                }
              ]}
            >
              <Ionicons
                name="mic-outline"
                size={16}
                color={person.color}
              />
              <Text
                style={[
                  type.body,
                  {
                    flex: 1,
                    color: colors.text
                  }
                ]}
              >
                {person.voice}
              </Text>
            </View>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingBottom: 200
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginTop: 8
  },
  cover: {
    width: 168,
    height: 236,
    borderRadius: 14,
    padding: 16,
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 12
    }
  },
  coverImage: {
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 12
    }
  },
  coverSpine: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    width: 3
  },
  coverBand: {
    width: 40,
    height: 3,
    marginTop: 12
  },
  coverTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 24,
    color: '#fff'
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
    marginTop: 20
  },
  author: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: colors.dim,
    marginTop: 4
  },
  progressCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  percent: {
    fontFamily: fonts.sansBold,
    fontSize: 15
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 3
  },
  continue: {
    marginTop: 4,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  continueText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: '#18131E'
  },
  disabled: {
    opacity: 0.55
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border
  },
  retryText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.text
  },
  section: {
    marginTop: 30
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.text
  },
  seeAll: {
    fontFamily: fonts.sansBold,
    fontSize: 14
  },
  chapterCard: {
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  chapterNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chapterNumberText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.dim
  },
  chapterName: {
    fontFamily: fonts.sansMd,
    fontSize: 15,
    color: colors.text
  },
  castCard: {
    width: 140,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    gap: 6
  },
  castAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  castInitial: {
    fontFamily: fonts.serif,
    fontSize: 20
  },
  castName: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.text
  },
  castVoice: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.dim
  },
  sheetName: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.text
  },
  voiceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1
  }
});
