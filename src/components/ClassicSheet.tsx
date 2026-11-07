import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { GradientButton } from './GradientButton';
import { colors, fonts, type } from '../../theme';
import type { Classic } from '../data/catalog';

/** Details for one public-domain classic, with a save-for-later toggle. */
export function ClassicSheet({ book, saved, onToggle, onClose }: { book: Classic | null; saved: boolean; onToggle: () => void; onClose: () => void }) {
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
          <Text style={type.meta}>Public domain. Narrating classics straight from the catalog is coming; for now, save it and upload your own copy.</Text>
          <GradientButton title={saved ? 'Saved for later' : 'Save for later'} icon={saved ? 'bookmark' : 'bookmark-outline'} variant={saved ? 'outline' : 'primary'} onPress={onToggle} />
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
