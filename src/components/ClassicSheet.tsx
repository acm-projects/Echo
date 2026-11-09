import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { GradientButton } from './GradientButton';
import { colors, fonts, type } from '../../theme';
import type { Classic } from '../data/catalog';
import { importClassic } from '../data/bookJobs';
import { currentSettings } from '../data/settings';
import { notify } from '../../lib/notify';

/** Details for one public-domain classic, with narrate and save-for-later buttons. */
// Narrating a classic downloads its Project Gutenberg text and runs it through the same pipeline as an upload, chapter
// by chapter; Book Details shows chapters as they finish.
export function ClassicSheet({ book, saved, onToggle, onClose }: { book: Classic | null; saved: boolean; onToggle: () => void; onClose: () => void }) {
  const [starting, setStarting] = useState(false);
  const narrate = async (classic: Classic) => {
    setStarting(true);
    try {
      const { jobId } = await importClassic({ gutenbergId: classic.gutenbergId, title: classic.title, author: classic.author, characterVoices: currentSettings().characterVoices });
      onClose();
      router.push({ pathname: '/Test/book_details', params: { id: jobId, title: classic.title, author: classic.author } });
    } catch (error) {
      notify('Couldn\u2019t start narrating', error instanceof Error ? error.message : 'The voice server didn\u2019t respond.');
    } finally {
      setStarting(false);
    }
  };
  return (
    <Sheet visible={book !== null} onClose={onClose}>
      {book && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={[s.cover, { backgroundColor: book.accent }]}>
              <Ionicons name="book" size={28} color="rgba(255,255,255,0.8)" />
            </View>
            <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
              <Text style={s.title}>{book.title}</Text>
              <Text style={type.body}>{book.author} · {book.year}</Text>
            </View>
          </View>
          <Text style={s.blurb}>{book.blurb}</Text>
          <Text style={type.meta}>Public domain, from Project Gutenberg. A full novel takes hours to narrate; you can start on chapter 1 as soon as it's ready.</Text>
          <GradientButton title={starting ? 'Starting\u2026' : 'Narrate this book'} icon="mic-outline" onPress={() => !starting && narrate(book)} />
          <GradientButton title={saved ? 'Saved for later' : 'Save for later'} icon={saved ? 'bookmark' : 'bookmark-outline'} variant="outline" onPress={onToggle} />
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  cover: { width: 76, height: 104, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 22, color: colors.text },
  blurb: { fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 24, color: colors.text },
});
