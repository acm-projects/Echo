import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '../../components/Screen';
import { colors, fonts, type } from '../../../theme';
import { getNarrators } from '../../data/narrators';
import { processBook, type BookJob } from '../../data/bookJobs';
import { notify } from '../../../lib/notify';
import { notifyChapterReady } from '../../data/notifications';
import { Sheet } from '../../components/Sheet';
import { ClassicSheet } from '../../components/ClassicSheet';
import { CastSheet } from '../../components/CastSheet';
import { CLASSICS, useSavedClassics, type Classic } from '../../data/catalog';
import { useSettings } from '../../data/settings';

// Same title the server gives the book: the file name without its extension.
const bookTitle = (fileName: string) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

function readyLabel(job: BookJob) {
  const chapters = job.chapters ?? [];
  const ready = chapters.filter((chapter) => chapter.status === 'ready').length;
  if (chapters.length <= 1) return 'Your audiobook is ready to play';
  return job.status === 'processing' ? `${ready} of ${chapters.length} chapters ready. The rest keep narrating.` : `${ready} of ${chapters.length} chapters ready`;
}

// The first few classics; See All opens the full catalog.
const PUBLIC_DOMAIN_BOOKS = CLASSICS.slice(0, 4);

export default function Upload() {
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  // The job being narrated, kept so a finished chapter can be opened while the rest of the book is made.
  const [job, setJob] = useState<BookJob | null>(null);
  const [narratorName, setNarratorName] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openBook, setOpenBook] = useState<Classic | null>(null);
  const [saved, toggleSaved] = useSavedClassics();
  const [settings, update] = useSettings();
  // The cast review opens once per book when its voices are ready, and again when the reader comes back from the
  // Voice Studio to use a voice they just made.
  const [castOpen, setCastOpen] = useState(false);
  const reviewedJob = useRef<string | null>(null);
  const reopenCast = useRef(false);

  useFocusEffect(useCallback(() => {
    getNarrators()
      .then((state) => setNarratorName(state.voices.find((voice) => voice.id === state.selectedId)?.name ?? null))
      .catch(() => setNarratorName(null));
    if (reopenCast.current) {
      reopenCast.current = false;
      setCastOpen(true);
    }
  }, []));

  const openStudio = () => {
    reopenCast.current = true;
    setCastOpen(false);
    router.push('/voice-studio');
  };

  const openJob = (current: BookJob) => {
    router.push({ pathname: '/Test/book_details', params: { id: current.jobId, title: selectedFile ? bookTitle(selectedFile) : 'Your book', author: 'Uploaded by you' } });
  };

  const selectAndProcess = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/epub+zip', 'text/plain', 'text/markdown', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    setSelectedFile(file.name);
    setProcessing(true);
    setStage('Uploading');
    setJob(null);
    try {
      const finished = await processBook(file, (update) => {
        setStage(update.stage);
        setJob(update);
        if (update.awaitingCast && reviewedJob.current !== update.jobId) {
          reviewedJob.current = update.jobId;
          setCastOpen(true);
        }
        // Only a multi-chapter book gets a note per chapter; a one-chapter book ends with the "Book ready" alert.
        const chapters = update.chapters ?? [];
        if (chapters.length > 1) for (const chapter of chapters) if (chapter.status === 'ready') void notifyChapterReady(update.jobId, chapter.index, bookTitle(file.name), chapter.title);
      }, { characterVoices: settings.characterVoices });
      const chapters = finished.chapters ?? [];
      const voices = finished.result?.roster?.characters.length ?? 0;
      const summary = chapters.length > 1 ? `${chapters.filter((c) => c.status === 'ready').length} of ${chapters.length} chapters narrated` : 'Narration finished';
      const reader = settings.characterVoices ? `with ${voices} voices` : 'by your narrator';
      notify('Book ready', `${summary} ${reader}.${finished.error ? ` ${finished.error}` : ''}`);
    } catch (error) {
      notify('Upload failed', error instanceof Error ? error.message : 'Could not process this file.');
    } finally {
      setProcessing(false);
      setStage(null);
    }
  };

  return (
    <Screen scene="tidewater">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <View style={s.header}>
          <Pressable style={s.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/Test/library'))} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={type.h1}>Add a Book</Text>
            <Text style={s.subtitle}>
              Upload your own or discover something new.
            </Text>
          </View>

            <Pressable style={s.help} onPress={() => setHelpOpen(true)} accessibilityRole="button" accessibilityLabel="How uploading works">
              <Ionicons
                name="help"
                size={18}
                color={colors.dim}
              />
            </Pressable>
        </View>

        <Pressable style={s.uploadCard} onPress={selectAndProcess} disabled={processing}>
          <View style={s.plusCircle}>
            <Ionicons
              name="add"
              size={38}
              color={colors.blue}
            />
          </View>

          <Text style={s.uploadTitle}>
            {processing ? selectedFile : selectedFile ?? 'Upload a File'}
          </Text>

          <Text style={s.uploadDescription}>
            {processing ? (job?.awaitingCast ? 'Waiting for you to approve the cast' : `${stage ?? 'Processing'}...`) : 'Add a book from your device'}
          </Text>

          <Text style={s.fileTypes}>
            PDF · EPUB · TXT · MD · Up to 50 MB
          </Text>
        </Pressable>

        {job?.awaitingCast && (
          <Pressable style={[s.narratorCard, s.reviewCard]} onPress={() => setCastOpen(true)} accessibilityRole="button">
            <View style={[s.narratorIcon, { backgroundColor: 'rgba(245,198,90,0.16)' }]}>
              <Ionicons name="people-outline" size={22} color={colors.gold} />
            </View>
            <View style={s.narratorInfo}>
              <Text style={s.narratorTitle}>The voices are ready</Text>
              <Text style={s.narratorSubtitle} numberOfLines={2}>Listen to the cast and start narrating.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.faint} />
          </Pressable>
        )}

        {job && (job.chapters ?? []).some((chapter) => chapter.status === 'ready') && (
          <Pressable style={s.narratorCard} onPress={() => openJob(job)} accessibilityRole="button">
            <View style={s.narratorIcon}>
              <Ionicons name="headset-outline" size={22} color={colors.pink} />
            </View>
            <View style={s.narratorInfo}>
              <Text style={s.narratorTitle}>{job.status === 'processing' ? 'Listen now' : 'Open your audiobook'}</Text>
              <Text style={s.narratorSubtitle} numberOfLines={2}>
                {readyLabel(job)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.faint} />
          </Pressable>
        )}

        <Pressable style={s.narratorCard} onPress={() => router.push('/voice-studio')}>
          <View style={s.narratorIcon}>
            <Ionicons name="mic-outline" size={22} color={colors.pink} />
          </View>
          <View style={s.narratorInfo}>
            <Text style={s.narratorTitle}>Voice Studio</Text>
            <Text style={s.narratorSubtitle} numberOfLines={1}>
              {narratorName ? `Narrating as ${narratorName}` : 'Design or record the voices that read your books'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.faint} />
        </Pressable>

        <View style={s.narratorCard}>
          <View style={s.narratorIcon}>
            <Ionicons name="pulse-outline" size={22} color={colors.pink} />
          </View>
          <View style={s.narratorInfo}>
            <Text style={s.narratorTitle}>Character Voices</Text>
            <Text style={s.narratorSubtitle} numberOfLines={2}>
              {settings.characterVoices ? 'A different voice for each character' : 'The whole book in your narrator\u2019s voice'}
            </Text>
          </View>
          <Switch
            value={settings.characterVoices}
            onValueChange={(v) => update('characterVoices', v)}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.pink }}
            thumbColor="#fff"
            accessibilityLabel="A different voice for each character"
          />
        </View>

        <View style={s.sectionHeader}>
          <View>
              <Text style={s.sectionTitle}>
                Public Domain
              </Text>

            <Text style={s.sectionDescription}>
              Books ready to add to your library
            </Text>
          </View>

          <Pressable onPress={() => router.push('/Test/catalog')} accessibilityRole="button">
            <Text style={s.seeAll}>
              See All
            </Text>
          </Pressable>
        </View>

        <View style={s.books}>
          {PUBLIC_DOMAIN_BOOKS.map((book) => (
            <View key={book.id} style={s.bookRow}>
              <Pressable style={s.bookTap}
                onPress={() => setOpenBook(book)}
                accessibilityRole="button"
              >
              <View
                style={[
                  s.cover,
                  { backgroundColor: book.accent },
                ]}
              >
                <Ionicons
                  name="book-outline"
                  size={25}
                  color="rgba(255,255,255,0.75)"
                />
              </View>

              <View style={s.bookInfo}>
                <Text
                  style={s.bookTitle}
                  numberOfLines={1}
                >
                  {book.title}
                </Text>

                <Text
                  style={s.bookAuthor}
                  numberOfLines={1}
                >
                  {book.author}
                </Text>

                <Text style={s.bookYear}>
                  {book.year}
                </Text>
              </View>

              </Pressable>
              <Pressable
                style={s.addBookButton}
                hitSlop={8}
                onPress={() => toggleSaved(book.id)}
                accessibilityRole="button"
                accessibilityLabel={saved.has(book.id) ? 'Remove from saved' : 'Save for later'}
              >
                <Ionicons
                  name={saved.has(book.id) ? 'bookmark' : 'add'}
                  size={saved.has(book.id) ? 20 : 24}
                  color={saved.has(book.id) ? colors.gold : colors.text}
                />
              </Pressable>
            </View>
          ))}
        </View>

      </ScrollView>

      {job && (
        <CastSheet
          visible={castOpen && Boolean(job.awaitingCast)}
          bookId={job.jobId}
          title={selectedFile ? bookTitle(selectedFile) : 'your book'}
          cast={job.cast ?? []}
          mode="review"
          onClose={() => setCastOpen(false)}
          onDone={() => { setCastOpen(false); setStage('Queued'); }}
          onOpenStudio={openStudio}
        />
      )}

      <ClassicSheet book={openBook} saved={openBook ? saved.has(openBook.id) : false} onToggle={() => openBook && toggleSaved(openBook.id)} onClose={() => setOpenBook(null)} />

      <Sheet visible={helpOpen} onClose={() => setHelpOpen(false)} title="How uploading works">
        <View style={{ gap: 12, paddingBottom: 8 }}>
          {[
            ['document-text-outline', 'PDF, EPUB, TXT or Markdown, up to 50 MB. The file needs real text; scanned page images can’t be read yet.'],
            ['people-outline', 'Echo reads the book, finds every character, and gives each one their own voice. You hear the cast before narration starts, and can swap any voice for one from your Voice Studio.'],
            ['time-outline', 'Books with chapters are narrated one chapter at a time, so you can start listening as soon as the first is ready. You can leave this screen; we’ll keep working.'],
            ['mic-outline', 'Your chosen narrator reads everything that isn’t dialogue.'],
          ].map(([icon, text]) => (
            <View key={icon} style={{ flexDirection: 'row', gap: 12 }}>
              <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.pink} />
              <Text style={[type.body, { flex: 1, lineHeight: 21 }]}>{text}</Text>
            </View>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  content: {
    padding: 20,
    paddingBottom: 150,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  subtitle: {
    ...type.body,
    marginTop: 5,
    color: colors.dim,
  },

  help: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadCard: {
    minHeight: 200,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(214,123,176,0.4)',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  plusCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(127,168,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  uploadTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 19,
  },

  uploadDescription: {
    ...type.body,
    color: colors.dim,
    marginTop: 5,
  },

  fileTypes: {
    ...type.meta,
    color: colors.faint,
    marginTop: 8,
  },

  narratorCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  reviewCard: { borderColor: 'rgba(245,198,90,0.5)' },

  narratorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(214,123,176,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  narratorInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  narratorTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 15,
  },

  narratorSubtitle: {
    ...type.meta,
    color: colors.dim,
    marginTop: 3,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 34,
    marginBottom: 14,
  },

  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 21,
    color: colors.text,
  },

  sectionDescription: {
    ...type.meta,
    marginTop: 4,
    color: colors.dim,
  },

  seeAll: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.blue,
  },

  books: {
    gap: 10,
  },

  // The row holds two sibling buttons (details, save); nesting them would put a <button> inside a <button> on web.
  bookTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },

  bookRow: {
    minHeight: 92,
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cover: {
    width: 54,
    height: 70,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bookInfo: {
    flex: 1,
    marginLeft: 14,
  },

  bookTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 15,
  },

  bookAuthor: {
    ...type.meta,
    color: colors.dim,
    marginTop: 4,
  },

  bookYear: {
    ...type.meta,
    color: colors.faint,
    fontSize: 10,
    marginTop: 4,
  },

  addBookButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  
});