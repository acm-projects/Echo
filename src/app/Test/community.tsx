import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { colors, fonts, type } from '../theme';

const POSTS = [
  { id: '1', user: 'Mira K.', book: 'The Night Circus', body: 'Chapter 7 gave me chills. The narrator\'s pacing is perfect.', likes: 24, replies: 6 },
  { id: '2', user: 'Dev P.', book: 'Dune', body: 'Anyone else assign different voices to the Fremen? Curious how you cast it.', likes: 11, replies: 9 },
];

export default function Community() {
  const [tab, setTab] = useState('Discussions');
  return (
    <Screen>
      <FlatList
        data={POSTS}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Text style={type.h1}>Community</Text>
            <View style={s.chips}>
              {['Discussions', 'Clubs', 'Shared casts'].map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={[s.chip, tab === t && s.chipActive]}>
                  <Text style={[s.chipText, tab === t && { color: '#2A1258' }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.post}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.text }}>{item.user}</Text>
              <Text style={[type.meta, { color: colors.blue }]}>{item.book}</Text>
            </View>
            <Text style={[type.body, { color: colors.text, marginVertical: 10 }]}>{item.body}</Text>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <View style={s.stat}><Ionicons name="heart-outline" size={18} color={colors.dim} /><Text style={type.meta}>{item.likes}</Text></View>
              <View style={s.stat}><Ionicons name="chatbubble-outline" size={18} color={colors.dim} /><Text style={type.meta}>{item.replies}</Text></View>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 10, marginTop: 16 },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#E3C3F5', borderColor: '#E3C3F5' },
  chipText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.dim },
  post: { padding: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
