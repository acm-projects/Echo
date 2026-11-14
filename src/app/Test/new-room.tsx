import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { colors, fonts, type } from '../../../theme';
import { notify } from '../../../lib/notify';
import { getMyBooks } from '../../data';
import { isBookId } from '../../data/supabaseRows';
import { NotSignedIn, createRoom, type Visibility } from '../../data/community';
import type { Book } from '../../data/types';

// Make a book room. The book can come from the reader's shelf or be typed in: rooms aren't tied to anyone's copy, and
// other readers count as "having" the book when a book on their shelf has the same title.
export default function NewRoom() {
  const [shelf, setShelf] = useState<Book[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyBooks().then((books) => setShelf(books.filter((b) => isBookId(b.id))), () => {});
  }, []);

  const pick = (book: Book) => {
    if (picked === book.id) {
      setPicked(null);
      return;
    }
    setPicked(book.id);
    setTitle(book.title);
    setAuthor(book.author ?? '');
  };

  const ready = title.trim().length > 0 && !saving;

  const create = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const room = await createRoom({ name, bookTitle: title, bookAuthor: author, visibility, description: about });
      router.replace({ pathname: '/Test/room', params: { id: room.id, title: name.trim() || title.trim() } });
    } catch (e) {
      if (e instanceof NotSignedIn) {
        notify('Sign in first', 'Book rooms live with your account.');
        router.push('/Test/login');
      } else {
        notify('Couldn’t make the room', e instanceof Error ? e.message : 'Try again in a moment.');
      }
      setSaving(false);
    }
  };

  return (
    <Screen interior="cafe">
      <PageHeader title="New book room" eyebrow="COMMUNITY" fallback="/Test/community" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.label}>THE BOOK</Text>
          {shelf.length > 0 && (
            <>
              <Text style={type.meta}>Pick one from your shelf, or type any book below.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shelf}>
                {shelf.map((book) => {
                  const on = picked === book.id;
                  return (
                    <Pressable key={book.id} onPress={() => pick(book)} style={[s.shelfBook, on && s.shelfBookOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <Ionicons name={on ? 'checkmark-circle' : 'book-outline'} size={16} color={on ? colors.blue : colors.dim} />
                      <Text style={[s.shelfTitle, on && { color: colors.text }]} numberOfLines={2}>{book.title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
          <TextInput value={title} onChangeText={(t) => { setTitle(t); setPicked(null); }} placeholder="Book title" placeholderTextColor={colors.faint} style={s.input} maxLength={500} />
          <TextInput value={author} onChangeText={(t) => { setAuthor(t); setPicked(null); }} placeholder="Author (optional)" placeholderTextColor={colors.faint} style={s.input} maxLength={300} />

          <Text style={[s.label, { marginTop: 22 }]}>THE ROOM</Text>
          <TextInput value={name} onChangeText={setName} placeholder={title.trim() ? `Room name (defaults to “${title.trim()}”)` : 'Room name (optional)'} placeholderTextColor={colors.faint} style={s.input} maxLength={80} />
          <TextInput value={about} onChangeText={setAbout} placeholder="What’s it for? e.g. a slow read, one chapter a week" placeholderTextColor={colors.faint} style={[s.input, { minHeight: 74, paddingTop: 13, textAlignVertical: 'top' }]} multiline maxLength={500} />

          <Text style={[s.label, { marginTop: 22 }]}>WHO CAN JOIN</Text>
          {([
            ['public', 'globe-outline', 'Public', 'Anyone can find it in search and join.'],
            ['private', 'lock-closed-outline', 'Private', 'Hidden. People join with an invite code you share.'],
          ] as const).map(([value, icon, label, detail]) => {
            const on = visibility === value;
            return (
              <Pressable key={value} onPress={() => setVisibility(value)} style={[s.option, on && s.optionOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                <Ionicons name={icon} size={20} color={on ? colors.pink : colors.dim} />
                <View style={{ flex: 1 }}>
                  <Text style={s.optionTitle}>{label}</Text>
                  <Text style={type.meta}>{detail}</Text>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.pink : colors.faint} />
              </Pressable>
            );
          })}

          <Pressable onPress={create} disabled={!ready} style={[s.create, !ready && { opacity: 0.4 }]} accessibilityRole="button">
            {saving ? <ActivityIndicator color="#29123C" /> : <Text style={s.createText}>Make the room</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 200, gap: 10 },
  label: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 2.2, color: colors.dim },
  shelf: { gap: 8, paddingVertical: 4 },
  shelfBook: { width: 128, minHeight: 64, gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  shelfBookOn: { borderColor: colors.blue, backgroundColor: 'rgba(127,168,230,0.12)' },
  shelfTitle: { fontFamily: fonts.sansMd, fontSize: 13, lineHeight: 17, color: colors.dim },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, color: colors.text, fontFamily: fonts.sansMd, fontSize: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, outlineStyle: 'none' } as object,
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  optionOn: { borderColor: colors.pink },
  optionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text, marginBottom: 2 },
  create: { marginTop: 18, height: 52, borderRadius: 10, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
  createText: { fontFamily: fonts.sansBold, fontSize: 16, color: '#29123C' },
});
