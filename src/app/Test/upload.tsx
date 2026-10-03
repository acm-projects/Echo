import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { colors, fonts, type } from '../../../theme';

const PUBLIC_DOMAIN_BOOKS = [
  {
    id: 'pride-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    year: '1813',
    accent: '#7D5C75',
  },
  {
    id: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    year: '1818',
    accent: '#45584D',
  },
  {
    id: 'dracula',
    title: 'Dracula',
    author: 'Bram Stoker',
    year: '1897',
    accent: '#603D49',
  },
  {
    id: 'gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    year: '1925',
    accent: '#3E596A',
  },
];

export default function Upload() {
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <View style={s.header}>
          <View>
            <Text style={type.h1}>Add a Book</Text>
            <Text style={s.subtitle}>
              Upload your own or discover something new.
            </Text>
          </View>

          <Pressable style={s.help}>
            <Ionicons
              name="help"
              size={18}
              color={colors.dim}
            />
          </Pressable>
        </View>

        <Pressable style={s.uploadCard}>
          <View style={s.plusCircle}>
            <Ionicons
              name="add"
              size={38}
              color={colors.blue}
            />
          </View>

          <Text style={s.uploadTitle}>
            Upload a File
          </Text>

          <Text style={s.uploadDescription}>
            Add a book from your device
          </Text>

          <Text style={s.fileTypes}>
            PDF · EPUB · MOBI · Up to 50 MB
          </Text>
        </Pressable>

        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionTitle}>
              Public Domain
            </Text>

            <Text style={s.sectionDescription}>
              Books ready to add to your library
            </Text>
          </View>

          <Pressable>
            <Text style={s.seeAll}>
              See All
            </Text>
          </Pressable>
        </View>

        <View style={s.books}>
          {PUBLIC_DOMAIN_BOOKS.map((book) => (
            <Pressable
              key={book.id}
              style={s.bookRow}
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

              <Pressable
                style={s.addBookButton}
                hitSlop={8}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </Pressable>
          ))}
        </View>

      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
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
    borderRadius: 26,
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

  bookRow: {
    minHeight: 92,
    padding: 11,
    borderRadius: 20,
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