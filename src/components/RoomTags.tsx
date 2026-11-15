import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';
import { shelfLabel, type Room } from '../data/community';

/** Public or private, and whether the reader has the room's book on their shelf. Shown on every room card. */
export function RoomTags({ room }: { room: Pick<Room, 'visibility' | 'myBookId' | 'myChapter'> }) {
  const onShelf = Boolean(room.myBookId);
  return (
    <View style={s.tags}>
      <View style={s.tag}>
        <Ionicons name={room.visibility === 'private' ? 'lock-closed-outline' : 'globe-outline'} size={11} color={colors.dim} />
        <Text style={s.tagText}>{room.visibility === 'private' ? 'Private' : 'Public'}</Text>
      </View>
      <View style={[s.tag, onShelf && s.tagShelf]}>
        <Ionicons name={onShelf ? 'book' : 'book-outline'} size={11} color={onShelf ? colors.blue : colors.faint} />
        <Text style={[s.tagText, onShelf && { color: colors.blue }]}>{shelfLabel(room)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  tagShelf: { borderColor: 'rgba(127,168,230,0.45)', backgroundColor: 'rgba(127,168,230,0.1)' },
  tagText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.dim },
});
